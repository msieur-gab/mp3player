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

        await this.db.open();
        console.log('[DatabaseService] Initialized');
    }

    /**
     * Save directory handle to database
     */
    async saveDirectoryHandle(handle) {
        await this.db.tracks.put({ id: 'root_handle', handle });
    }

    /**
     * Get saved directory handle
     */
    async getDirectoryHandle() {
        const root = await this.db.tracks.get('root_handle');
        return root?.handle || null;
    }

    /**
     * Clear all tracks except directory handle
     */
    async clearTracks() {
        await this.db.tracks.where('id').notEqual('root_handle').delete();
    }

    /**
     * Bulk add tracks to database
     */
    async bulkAddTracks(tracks) {
        await this.db.tracks.bulkAdd(tracks);
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
}

export default DatabaseService;
