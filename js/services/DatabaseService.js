/**
 * DatabaseService - Handles all IndexedDB operations using Dexie
 */
class DatabaseService {
    constructor() {
        this.db = null;
        this.ROW_HEIGHT = 60;
        this.BATCH_SIZE = 500;
    }

    /**
     * Initialize the database with schema
     */
    async init() {
        this.db = new Dexie("MegaMusicPWA");

        // Schema v1
        this.db.version(1).stores({
            tracks: '++id, title, artist, path, album'
        });

        // Schema v2 - Add trackNumber field
        this.db.version(2)
            .stores({
                tracks: '++id, title, artist, path, album, trackNumber'
            })
            .upgrade(tx => {
                return tx.table("tracks").toCollection().modify(track => {
                    if (!track.trackNumber) track.trackNumber = null;
                });
            });

        // Schema v3 - Add metadata fields (genre, year, duration, coverArt)
        this.db.version(3)
            .stores({
                tracks: '++id, title, artist, path, album, trackNumber, genre, year, duration'
            })
            .upgrade(tx => {
                return tx.table("tracks").toCollection().modify(track => {
                    if (!track.genre) track.genre = null;
                    if (!track.year) track.year = null;
                    if (!track.duration) track.duration = null;
                    if (!track.coverArt) track.coverArt = null;
                });
            });

        // Schema v4 - Add play count tracking table
        this.db.version(4)
            .stores({
                tracks: '++id, title, artist, path, album, trackNumber, genre, year, duration',
                playCount: '++id, &trackKey, playCount, lastPlayed'
            })
            .upgrade(tx => {
                console.log('[DatabaseService] Upgraded to v4: Added playCount table');
            });

        // Schema v5 - Add covers table for persistent album artwork
        this.db.version(5)
            .stores({
                tracks: '++id, title, artist, path, album, trackNumber, genre, year, duration',
                playCount: '++id, &trackKey, playCount, lastPlayed',
                covers: '++id, &albumKey, coverData'
            })
            .upgrade(tx => {
                console.log('[DatabaseService] Upgraded to v5: Added covers table');
            });

        // Schema v6 - Add scanSessionId for progressive scanning
        this.db.version(6)
            .stores({
                tracks: '++id, title, artist, path, album, trackNumber, genre, year, duration, scanSessionId',
                playCount: '++id, &trackKey, playCount, lastPlayed',
                covers: '++id, &albumKey, coverData'
            })
            .upgrade(tx => {
                console.log('[DatabaseService] Upgraded to v6: Added scanSessionId for non-destructive scanning');
                return tx.table("tracks").toCollection().modify(track => {
                    if (!track.scanSessionId) track.scanSessionId = null;
                });
            });

        await this.db.open();
        console.log('[DatabaseService] Initialized');
    }

    /**
     * Note: Directory handles are managed by PermissionManagerService
     * using native IndexedDB (not Dexie) for proper structured cloning.
     * FileSystemDirectoryHandle objects cannot be reliably serialized via Dexie.
     */

    /**
     * Clear all tracks except directory handle
     */
    async clearTracks() {
        await this.db.tracks.where('id').notEqual('root_handle').delete();
    }

    /**
     * Remove tracks not in current scan session
     * @param {number} scanSessionId - Current scan session timestamp
     */
    async removeTracksNotInScan(scanSessionId) {
        const deleted = await this.db.tracks
            .where('id').notEqual('root_handle')
            .and(track => track.scanSessionId !== scanSessionId)
            .delete();

        console.log(`[DatabaseService] Removed ${deleted} tracks from previous scans`);
        return deleted;
    }

    /**
     * Bulk add tracks to database
     * Preserves existing track data (especially duration) during rescans
     */
    async bulkAddTracks(tracks) {
        // Get all existing tracks indexed by path for fast lookup
        const existingTracks = await this.db.tracks.toArray();
        const existingByPath = new Map();
        existingTracks.forEach(track => {
            if (track.path) {
                existingByPath.set(track.path, track);
            }
        });

        const tracksToAdd = [];
        const tracksToUpdate = [];

        for (const track of tracks) {
            const existing = existingByPath.get(track.path);

            if (existing) {
                // Track exists - update it, preserving duration and other extracted data
                tracksToUpdate.push({
                    key: existing.id,
                    changes: {
                        // Update handle and scanSessionId (scan data)
                        handle: track.handle,
                        scanSessionId: track.scanSessionId,
                        // Update metadata that might have changed
                        title: track.title,
                        artist: track.artist,
                        album: track.album,
                        trackNumber: track.trackNumber,
                        genre: track.genre,
                        year: track.year,
                        coverArt: track.coverArt,
                        // Preserve duration if it exists (don't overwrite with null)
                        ...(existing.duration && { duration: existing.duration })
                    }
                });
            } else {
                // New track - add it
                tracksToAdd.push(track);
            }
        }

        // Perform bulk operations
        if (tracksToAdd.length > 0) {
            await this.db.tracks.bulkAdd(tracksToAdd);
        }

        if (tracksToUpdate.length > 0) {
            await this.db.tracks.bulkUpdate(tracksToUpdate);
        }

        console.log(`[DatabaseService] Added ${tracksToAdd.length} new tracks, updated ${tracksToUpdate.length} existing tracks`);
    }

    /**
     * Get all tracks from database
     */
    async getAllTracks() {
        return await this.db.tracks.where('id').notEqual('root_handle').toArray();
    }

    /**
     * Update a track by id
     */
    async updateTrack(id, updates) {
        await this.db.tracks.update(id, updates);
    }

    /**
     * Get a track by id
     */
    async getTrack(id) {
        return await this.db.tracks.get(id);
    }

    /**
     * Delete a track by id
     */
    async deleteTrack(id) {
        await this.db.tracks.delete(id);
    }

    /**
     * Get database statistics
     */
    async getStats() {
        const count = await this.db.tracks.where('id').notEqual('root_handle').count();
        return { trackCount: count };
    }

    /**
     * Generate normalized track key for play count tracking
     * @param {Object} track - Track object with title, artist, album
     * @returns {string} Normalized key: "title|artist|album"
     */
    generateTrackKey(track) {
        const title = (track.title || 'Unknown').toLowerCase().trim();
        const artist = (track.artist || 'Unknown Artist').toLowerCase().trim();
        const album = (track.album || 'Unknown Album').toLowerCase().trim();
        return `${title}|${artist}|${album}`;
    }

    /**
     * Generate normalized album key for cover storage
     * @param {string} album - Album name
     * @param {string} artist - Artist name
     * @returns {string} Normalized key: "album|artist"
     */
    generateAlbumKey(album, artist) {
        const albumNorm = (album || 'Unknown Album').toLowerCase().trim();
        const artistNorm = (artist || 'Unknown Artist').toLowerCase().trim();
        return `${albumNorm}|${artistNorm}`;
    }

    /**
     * Increment play count for a track
     * @param {Object} track - Track object with title, artist, album
     */
    async incrementPlayCount(track) {
        const trackKey = this.generateTrackKey(track);

        try {
            // Try to get existing entry
            const existing = await this.db.playCount.get({ trackKey: trackKey });

            if (existing) {
                // Update existing entry
                await this.db.playCount.update(existing.id, {
                    playCount: existing.playCount + 1,
                    lastPlayed: Date.now()
                });
                console.log(`[DatabaseService] Play count incremented: ${existing.playCount + 1} for "${track.title}"`);
            } else {
                // Create new entry
                await this.db.playCount.add({
                    trackKey: trackKey,
                    playCount: 1,
                    lastPlayed: Date.now()
                });
                console.log(`[DatabaseService] Play count initialized for "${track.title}"`);
            }
        } catch (error) {
            console.error('[DatabaseService] Error updating play count:', error);
        }
    }

    /**
     * Get play count for a track
     * @param {Object} track - Track object with title, artist, album
     * @returns {number} Play count (0 if never played)
     */
    async getPlayCount(track) {
        const trackKey = this.generateTrackKey(track);
        const entry = await this.db.playCount.get({ trackKey: trackKey });
        return entry ? entry.playCount : 0;
    }

    /**
     * Get most played tracks
     * @param {number} limit - Maximum number of tracks to return
     * @returns {Array} Array of play count entries, sorted by playCount descending
     */
    async getMostPlayed(limit = 20) {
        return await this.db.playCount
            .orderBy('playCount')
            .reverse()
            .limit(limit)
            .toArray();
    }

    /**
     * Get recently played tracks
     * @param {number} limit - Maximum number of tracks to return
     * @returns {Array} Array of play count entries, sorted by lastPlayed descending
     */
    async getRecentlyPlayed(limit = 20) {
        return await this.db.playCount
            .orderBy('lastPlayed')
            .reverse()
            .limit(limit)
            .toArray();
    }

    /**
     * Get top artists by total play count
     * @param {number} limit - Maximum number of artists to return
     * @returns {Array} Array of {artist, playCount} objects, sorted by playCount descending
     */
    async getTopArtists(limit = 10) {
        const allPlayCounts = await this.db.playCount.toArray();
        const artistCounts = {};

        // Aggregate play counts by artist
        allPlayCounts.forEach(entry => {
            // Parse trackKey: "title|artist|album"
            const parts = entry.trackKey.split('|');
            if (parts.length === 3) {
                const artist = parts[1]; // artist is the second part
                if (!artistCounts[artist]) {
                    artistCounts[artist] = 0;
                }
                artistCounts[artist] += entry.playCount;
            }
        });

        // Convert to array and sort
        return Object.entries(artistCounts)
            .map(([artist, playCount]) => ({ artist, playCount }))
            .sort((a, b) => b.playCount - a.playCount)
            .slice(0, limit);
    }

    /**
     * Get top albums by total play count
     * @param {number} limit - Maximum number of albums to return
     * @returns {Array} Array of {album, artist, playCount} objects, sorted by playCount descending
     */
    async getTopAlbums(limit = 10) {
        const allPlayCounts = await this.db.playCount.toArray();
        const albumCounts = {};

        // Aggregate play counts by album (including artist for disambiguation)
        allPlayCounts.forEach(entry => {
            // Parse trackKey: "title|artist|album"
            const parts = entry.trackKey.split('|');
            if (parts.length === 3) {
                const artist = parts[1];
                const album = parts[2];
                const key = `${album}|${artist}`; // Composite key for uniqueness

                if (!albumCounts[key]) {
                    albumCounts[key] = {
                        album: album,
                        artist: artist,
                        playCount: 0
                    };
                }
                albumCounts[key].playCount += entry.playCount;
            }
        });

        // Convert to array and sort
        return Object.values(albumCounts)
            .sort((a, b) => b.playCount - a.playCount)
            .slice(0, limit);
    }

    /**
     * Get top tracks by play count (with parsed metadata)
     * @param {number} limit - Maximum number of tracks to return
     * @returns {Array} Array of {title, artist, album, playCount, lastPlayed} objects
     */
    async getTopTracks(limit = 10) {
        const entries = await this.getMostPlayed(limit);

        // Parse trackKey and return enriched data
        return entries.map(entry => {
            const parts = entry.trackKey.split('|');
            return {
                title: parts[0] || 'Unknown',
                artist: parts[1] || 'Unknown Artist',
                album: parts[2] || 'Unknown Album',
                playCount: entry.playCount,
                lastPlayed: entry.lastPlayed
            };
        });
    }

    /**
     * Log top 10 statistics to console
     * Useful for testing and debugging
     */
    async logTopStats() {
        console.log('\n========== TOP 10 STATISTICS ==========\n');

        // Top Tracks
        const topTracks = await this.getTopTracks(10);
        console.log('🎵 TOP 10 TRACKS:');
        topTracks.forEach((track, index) => {
            console.log(`${index + 1}. "${track.title}" by ${track.artist} (${track.playCount} plays)`);
        });

        // Top Artists
        const topArtists = await this.getTopArtists(10);
        console.log('\n🎤 TOP 10 ARTISTS:');
        topArtists.forEach((item, index) => {
            console.log(`${index + 1}. ${item.artist} (${item.playCount} plays)`);
        });

        // Top Albums
        const topAlbums = await this.getTopAlbums(10);
        console.log('\n💿 TOP 10 ALBUMS:');
        topAlbums.forEach((item, index) => {
            console.log(`${index + 1}. "${item.album}" by ${item.artist} (${item.playCount} plays)`);
        });

        console.log('\n=======================================\n');

        return { topTracks, topArtists, topAlbums };
    }

    /**
     * Save cover to database
     * @param {string} album - Album name
     * @param {string} artist - Artist name
     * @param {Blob} data - WebP blob
     */
    async saveCover(album, artist, data) {
        await this.db.covers.put({
            albumKey: this.generateAlbumKey(album, artist),
            coverData: data
        });
    }

    /**
     * Get cover from database
     * @param {string} album - Album name
     * @param {string} artist - Artist name
     * @returns {Blob|null} WebP blob or null
     */
    async getCover(album, artist) {
        const entry = await this.db.covers.get({ albumKey: this.generateAlbumKey(album, artist) });
        return entry?.coverData || null;
    }
}

export default DatabaseService;
