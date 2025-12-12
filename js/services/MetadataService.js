/**
 * MetadataService - Handles ID3 tag extraction and album cover processing
 */
import EventBus from '../utils/EventBus.js';

class MetadataService {
    constructor(databaseService) {
        this.db = databaseService;
        this.albumCovers = {}; // Cache: { "Album Name": "data:image/..." }
    }

    /**
     * Extract metadata from a file
     * @param {File} file - Audio file
     * @returns {Promise<Object>} Metadata object
     */
    async extractMetadata(file) {
        return new Promise((resolve, reject) => {
            window.jsmediatags.read(file, {
                onSuccess: (tag) => resolve(tag.tags),
                onError: (error) => reject(error)
            });
        });
    }

    /**
     * Extract duration from audio file using Audio element
     * Duration is NOT in ID3 tags, must be read from actual audio data
     * @param {File} file - Audio file
     * @returns {Promise<number|null>} Duration in seconds, or null on error
     */
    async extractDuration(file) {
        return new Promise((resolve) => {
            const audio = new Audio();
            const url = URL.createObjectURL(file);

            audio.addEventListener('loadedmetadata', () => {
                URL.revokeObjectURL(url);
                resolve(Math.round(audio.duration)); // Duration in seconds
            });

            audio.addEventListener('error', () => {
                URL.revokeObjectURL(url);
                resolve(null); // Return null on error, don't fail the scan
            });

            audio.src = url;
        });
    }

    /**
     * Extract album cover art from file
     * @param {File} file - Audio file
     * @returns {Promise<string|null>} Base64 image data URL or null
     */
    async extractAlbumArt(file) {
        try {
            const tags = await this.extractMetadata(file);
            if (tags.picture) {
                const { data, format } = tags.picture;
                let base64String = "";
                for (let i = 0; i < data.length; i++) {
                    base64String += String.fromCharCode(data[i]);
                }
                return `data:${format};base64,${window.btoa(base64String)}`;
            }
            return null;
        } catch (error) {
            console.error('[MetadataService] Error extracting album art:', error);
            return null;
        }
    }

    /**
     * Compress cover art to WebP 200x200 Blob
     * @param {string} dataUrl - Base64 image data URL
     * @returns {Promise<Blob>} Compressed WebP blob
     */
    async compressCover(dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = canvas.height = 200;
                canvas.getContext('2d').drawImage(img, 0, 0, 200, 200);
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to create blob'));
                    }
                }, 'image/webp', 0.85);
            };
            img.onerror = reject;
            img.src = dataUrl;
        });
    }

    /**
     * Extract album covers for a list of albums
     * @param {Object} albums - Albums object { "Album Name": [tracks...] }
     */
    async extractAlbumCovers(albums) {
        for (const albumName of Object.keys(albums)) {
            // Skip if already in memory cache
            if (this.albumCovers[albumName]) continue;

            const track = albums[albumName][0];
            if (!track?.handle) continue;

            // Check database first (fast path)
            const cached = await this.db.getCover(albumName, track.artist);
            if (cached) {
                // Memory leak fix: Revoke old URL before replacing
                const existingUrl = this.albumCovers[albumName];
                if (existingUrl && existingUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(existingUrl);
                }

                // Convert blob to object URL for rendering
                const coverUrl = URL.createObjectURL(cached);
                this.albumCovers[albumName] = coverUrl;
                EventBus.emit('albumCover:extracted', { albumName, coverUrl });
                continue;
            }

            // Extract from file if not cached (slow path)
            try {
                const file = await track.handle.getFile();
                const cover = await this.extractAlbumArt(file);
                if (cover) {
                    const compressed = await this.compressCover(cover);
                    await this.db.saveCover(albumName, track.artist, compressed);

                    // Memory leak fix: Revoke old URL before replacing
                    const existingUrl = this.albumCovers[albumName];
                    if (existingUrl && existingUrl.startsWith('blob:')) {
                        URL.revokeObjectURL(existingUrl);
                    }

                    // Convert blob to object URL for rendering
                    const coverUrl = URL.createObjectURL(compressed);
                    this.albumCovers[albumName] = coverUrl;
                    EventBus.emit('albumCover:extracted', { albumName, coverUrl });
                }
            } catch (error) {
                console.warn(`[MetadataService] Could not extract cover for ${albumName}`);
            }
        }

        EventBus.emit('albumCovers:complete');
    }

    /**
     * Get cached album cover
     * @param {string} albumName - Album name
     * @returns {string|null} Cover URL or null
     */
    getAlbumCover(albumName) {
        return this.albumCovers[albumName] || null;
    }

    /**
     * Clear album cover cache
     * Memory leak fix: Revoke all object URLs before clearing
     */
    clearCoverCache() {
        Object.values(this.albumCovers).forEach(url => {
            if (url && url.startsWith('blob:')) {
                URL.revokeObjectURL(url);
            }
        });
        this.albumCovers = {};
    }

    /**
     * Update track metadata in database (self-healing)
     * @param {Object} track - Track object
     * @param {File} file - Audio file
     */
    async updateTrackMetadata(track, file) {
        try {
            const tags = await this.extractMetadata(file);
            let needsUpdate = false;
            const updates = {};

            // Title
            if (tags.title && tags.title !== track.title) {
                updates.title = tags.title;
                needsUpdate = true;
            }

            // Artist
            if (tags.artist && tags.artist !== track.artist) {
                updates.artist = tags.artist;
                needsUpdate = true;
            }

            // Track Number
            if (tags.track && tags.track !== track.trackNumber) {
                const trackNum = typeof tags.track === 'string' ? parseInt(tags.track, 10) : tags.track;
                if (!isNaN(trackNum)) {
                    updates.trackNumber = trackNum;
                    needsUpdate = true;
                }
            }

            // Save to database
            if (needsUpdate) {
                await this.db.updateTrack(track.id, updates);
                EventBus.emit('track:metadataUpdated', { trackId: track.id, updates });
            }

            return { tags, needsUpdate, updates };
        } catch (error) {
            console.error('[MetadataService] Error updating track metadata:', error);
            return { tags: null, needsUpdate: false, updates: {} };
        }
    }
}

export default MetadataService;
