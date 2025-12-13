/**
 * FileSystemService - Handles SD card/file system access and scanning
 */
import EventBus from '../utils/EventBus.js';

class FileSystemService {
    constructor(databaseService, metadataService, permissionManager) {
        this.db = databaseService;
        this.metadata = metadataService;
        this.permissions = permissionManager;
        this.BATCH_SIZE = 500;

        // Memory leak fix: Store bound handler for removal
        this.visibilityHandler = this.handleVisibilityChange.bind(this);

        // Setup visibility handler to re-check permissions
        this.setupVisibilityHandler();
    }

    /**
     * Setup page visibility handler to re-check permissions
     * Memory leak fix: Use bound handler for removal
     */
    setupVisibilityHandler() {
        document.addEventListener('visibilitychange', this.visibilityHandler);
    }

    /**
     * Handle visibility change events
     */
    async handleVisibilityChange() {
        if (!document.hidden) {
            const handle = await this.permissions.getHandle();
            if (!handle) return;

            const status = await this.permissions.checkPermission();
            if (status !== 'granted') {
                console.log('[FileSystemService] Permission lost, showing banner');
                EventBus.emit('permission:needed');
            }
        }
    }

    /**
     * Initialize the service
     */
    async init() {
        console.log('[FileSystemService] Initialized');
        // All permission logic moved to PermissionManagerService
    }

    /**
     * Request directory access from user
     */
    async requestDirectoryAccess() {
        if (!window.showDirectoryPicker) {
            throw new Error('File System Access API not supported');
        }

        const handle = await window.showDirectoryPicker({
            id: 'music_root',
            mode: 'read'
        });

        await this.permissions.saveHandle(handle);
        return handle;
    }

    /**
     * Check and request permission if needed
     * @returns {Promise<boolean>} True if granted, false otherwise
     */
    async ensurePermission() {
        const handle = await this.permissions.getHandle();
        if (!handle) return false;

        const status = await this.permissions.checkPermission();
        if (status === 'granted') return true;

        // Permission not granted - show banner immediately
        console.log('[FileSystemService] Permission needed, showing banner');
        EventBus.emit('permission:needed');
        return false;
    }

    /**
     * Scan directory for music files with progressive album streaming
     * @param {function} onProgress - Progress callback (count, currentFile)
     */
    async scanDirectory(onProgress) {
        const handle = await this.permissions.getHandle();
        if (!handle) {
            throw new Error('No directory handle available');
        }

        // Check permission before scanning
        const hasPermission = await this.ensurePermission();
        if (!hasPermission) {
            throw new Error('Permission denied');
        }

        // Generate scan session ID for non-destructive scanning
        const scanSessionId = Date.now();
        console.log(`[FileSystemService] Starting scan session: ${scanSessionId}`);

        // Group tracks by album for progressive flushing
        let albumBuffer = {};
        let totalCount = 0;

        /**
         * Flush an album to the database and emit UI event
         */
        const flushAlbum = async (albumName, artistName) => {
            const albumKey = `${albumName}|${artistName}`;
            const tracks = albumBuffer[albumKey];

            if (tracks && tracks.length > 0) {
                // Add scanSessionId to all tracks
                const tracksWithSession = tracks.map(t => ({
                    ...t,
                    scanSessionId
                }));

                await this.db.bulkAddTracks(tracksWithSession);

                // Emit album found event for progressive UI updates
                EventBus.emit('scan:albumFound', {
                    albumName,
                    artistName,
                    trackCount: tracks.length,
                    totalCount
                });

                console.log(`[FileSystemService] 💿 Album flushed: "${albumName}" (${tracks.length} tracks)`);
                delete albumBuffer[albumKey];
            }
        };

        /**
         * Process a single music file
         */
        const processFile = async (entry, name, path) => {
            try {
                // Get file for metadata extraction
                const file = await entry.getFile();

                // Extract metadata using jsmediatags
                const metadata = await this.metadata.extractMetadata(file);

                // Extract folder structure for fallbacks
                const pathParts = path.split('/').filter(p => p);
                const folderName = pathParts[pathParts.length - 1] || "Unknown Album";
                const parentFolder = pathParts[pathParts.length - 2] || "Unknown Artist";

                // Extract track number from filename as fallback
                const trackMatch = name.match(/^(\d+)/);
                const filenameTrackNumber = trackMatch ? parseInt(trackMatch[1], 10) : null;

                // Parse track number from metadata (can be "1" or "1/12" format)
                let metadataTrackNumber = null;
                if (metadata.track) {
                    const trackStr = String(metadata.track).split('/')[0];
                    metadataTrackNumber = parseInt(trackStr, 10);
                }

                // Clean filename for fallback title
                let cleanTitle = name.replace(/\.[^/.]+$/, '');
                cleanTitle = cleanTitle.replace(/^\d+[\s\-_.]*/, '');

                // Build track object
                return {
                    title: metadata.title || cleanTitle,
                    handle: entry,
                    path: path + "/" + name,
                    album: metadata.album || folderName,
                    artist: metadata.artist || parentFolder,
                    trackNumber: metadataTrackNumber || filenameTrackNumber,
                    genre: metadata.genre || null,
                    year: metadata.year || null,
                    duration: null,
                    coverArt: metadata.picture ? true : false
                };

            } catch (error) {
                console.warn(`[FileSystemService] Metadata extraction failed for ${name}:`, error);

                // Fallback to filename and folder structure
                const pathParts = path.split('/').filter(p => p);
                const folderName = pathParts[pathParts.length - 1] || "Unknown Album";
                const parentFolder = pathParts[pathParts.length - 2] || "Unknown Artist";
                const trackMatch = name.match(/^(\d+)/);
                const trackNumber = trackMatch ? parseInt(trackMatch[1], 10) : null;
                let cleanTitle = name.replace(/\.[^/.]+$/, '');
                cleanTitle = cleanTitle.replace(/^\d+[\s\-_.]*/, '');

                return {
                    title: cleanTitle,
                    handle: entry,
                    path: path + "/" + name,
                    album: folderName,
                    artist: parentFolder,
                    trackNumber: trackNumber,
                    genre: null,
                    year: null,
                    duration: null,
                    coverArt: false
                };
            }
        };

        /**
         * Traverse directory tree recursively
         */
        const traverse = async (handle, path, currentAlbumKey = null) => {
            let lastAlbumKey = currentAlbumKey;

            for await (const entry of handle.values()) {
                if (entry.kind === 'file') {
                    const name = entry.name;

                    // Skip hidden files and macOS resource fork files
                    if (name.startsWith('.') || name.startsWith('._')) {
                        continue;
                    }

                    if (/\.(mp3|m4a|flac|wav|ogg)$/i.test(name)) {
                        const track = await processFile(entry, name, path);
                        const albumKey = `${track.album}|${track.artist}`;

                        // Album changed? Flush previous album
                        if (lastAlbumKey && albumKey !== lastAlbumKey) {
                            const [prevAlbum, prevArtist] = lastAlbumKey.split('|');
                            await flushAlbum(prevAlbum, prevArtist);
                        }

                        // Add to buffer
                        if (!albumBuffer[albumKey]) {
                            albumBuffer[albumKey] = [];
                        }
                        albumBuffer[albumKey].push(track);

                        lastAlbumKey = albumKey;
                        totalCount++;

                        if (onProgress) onProgress(totalCount, name);
                    }
                } else if (entry.kind === 'directory') {
                    // Flush current album before entering subdirectory
                    if (lastAlbumKey) {
                        const [album, artist] = lastAlbumKey.split('|');
                        await flushAlbum(album, artist);
                        lastAlbumKey = null;
                    }

                    await traverse(entry, path + "/" + entry.name);
                }
            }

            // Flush remaining album at end of directory
            if (lastAlbumKey) {
                const [album, artist] = lastAlbumKey.split('|');
                await flushAlbum(album, artist);
            }
        };

        EventBus.emit('scan:started');
        await traverse(handle, "");

        // Flush any remaining albums
        for (const albumKey in albumBuffer) {
            const [album, artist] = albumKey.split('|');
            await flushAlbum(album, artist);
        }

        // Remove tracks from previous scans
        await this.db.removeTracksNotInScan(scanSessionId);

        EventBus.emit('scan:completed', totalCount);
        console.log(`[FileSystemService] ✅ Scan completed: ${totalCount} tracks`);
        return totalCount;
    }

    /**
     * Get directory handle
     */
    async getDirectoryHandle() {
        return await this.permissions.getHandle();
    }

    /**
     * Cleanup resources
     * Memory leak fix: Remove visibility listener
     */
    destroy() {
        console.log('[FileSystemService] 🗑️ Destroying service');
        document.removeEventListener('visibilitychange', this.visibilityHandler);
    }
}

export default FileSystemService;
