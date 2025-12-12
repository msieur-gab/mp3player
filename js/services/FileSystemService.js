/**
 * FileSystemService - Handles SD card/file system access and scanning
 */
import EventBus from '../utils/EventBus.js';

class FileSystemService {
    constructor(databaseService, metadataService) {
        this.db = databaseService;
        this.metadata = metadataService;
        this.dirHandleRoot = null;
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
        if (!document.hidden && this.dirHandleRoot) {
            const perm = await this.dirHandleRoot.queryPermission({ mode: 'read' });
            if (perm !== 'granted') {
                EventBus.emit('permission:needed');
            }
        }
    }

    /**
     * Initialize the service by restoring saved directory handle
     */
    async init() {
        try {
            const handle = await this.db.getDirectoryHandle();
            if (handle) {
                this.dirHandleRoot = handle;
                // Check permissions
                const perm = await handle.queryPermission({ mode: 'read' });
                if (perm !== 'granted') {
                    EventBus.emit('permission:needed');
                }
            }
            console.log('[FileSystemService] Initialized');
        } catch (error) {
            console.error('[FileSystemService] Init error:', error);
        }
    }

    /**
     * Request directory access from user
     */
    async requestDirectoryAccess() {
        if (!window.showDirectoryPicker) {
            throw new Error('File System Access API not supported');
        }

        this.dirHandleRoot = await window.showDirectoryPicker({
            id: 'music_root',
            mode: 'read'
        });

        // Save handle to database
        await this.db.saveDirectoryHandle(this.dirHandleRoot);
        return this.dirHandleRoot;
    }

    /**
     * Request permission for saved directory handle
     */
    async requestPermission() {
        if (!this.dirHandleRoot) return false;
        const permission = await this.dirHandleRoot.requestPermission({ mode: 'read' });
        return permission === 'granted';
    }

    /**
     * Check and request permission if needed
     * @returns {Promise<boolean>} True if granted, false otherwise
     */
    async ensurePermission() {
        if (!this.dirHandleRoot) return false;

        const perm = await this.dirHandleRoot.queryPermission({ mode: 'read' });
        if (perm === 'granted') return true;

        // Emit event to notify UI
        EventBus.emit('permission:needed');

        // Try to request permission
        const newPerm = await this.dirHandleRoot.requestPermission({ mode: 'read' });
        return newPerm === 'granted';
    }

    /**
     * Scan directory for music files
     * @param {function} onProgress - Progress callback (count, currentFile)
     */
    async scanDirectory(onProgress) {
        if (!this.dirHandleRoot) {
            throw new Error('No directory handle available');
        }

        // Check permission before scanning
        const hasPermission = await this.ensurePermission();
        if (!hasPermission) {
            throw new Error('Permission denied');
        }

        // Clear existing tracks
        await this.db.clearTracks();

        let buffer = [];
        let count = 0;

        const traverse = async (handle, path) => {
            for await (const entry of handle.values()) {
                if (entry.kind === 'file') {
                    const name = entry.name;
                    if (/\.(mp3|m4a|flac|wav|ogg)$/i.test(name)) {
                        try {
                            // Get file for metadata extraction
                            const file = await entry.getFile();

                            // Extract metadata using jsmediatags
                            const metadata = await this.metadata.extractMetadata(file);

                            // Log metadata structure (excluding picture data)
                            console.log(`[Metadata] ${name}:`, {
                                title: metadata.title,
                                artist: metadata.artist,
                                album: metadata.album,
                                genre: metadata.genre,
                                year: metadata.year,
                                track: metadata.track,
                                hasPicture: !!metadata.picture,
                                // Show all available metadata fields
                                allFields: Object.keys(metadata).filter(k => k !== 'picture')
                            });

                            // Extract folder structure for fallbacks
                            const pathParts = path.split('/').filter(p => p); // Remove empty strings
                            const folderName = pathParts[pathParts.length - 1] || "Unknown Album";     // Current folder
                            const parentFolder = pathParts[pathParts.length - 2] || "Unknown Artist";  // Parent folder

                            // Extract track number from filename as fallback
                            const trackMatch = name.match(/^(\d+)/);
                            const filenameTrackNumber = trackMatch ? parseInt(trackMatch[1], 10) : null;

                            // Parse track number from metadata (can be "1" or "1/12" format)
                            let metadataTrackNumber = null;
                            if (metadata.track) {
                                const trackStr = String(metadata.track).split('/')[0]; // Take first part if "1/12"
                                metadataTrackNumber = parseInt(trackStr, 10);
                            }

                            // Clean filename for fallback title
                            let cleanTitle = name.replace(/\.[^/.]+$/, ''); // Remove extension
                            cleanTitle = cleanTitle.replace(/^\d+[\s\-_.]*/, ''); // Remove leading track number

                            // Build track object with metadata (ID3 tags are primary, folder structure is fallback)
                            buffer.push({
                                title: metadata.title || cleanTitle,
                                handle: entry,
                                path: path + "/" + name,
                                album: metadata.album || folderName,
                                artist: metadata.artist || parentFolder,
                                trackNumber: metadataTrackNumber || filenameTrackNumber,
                                genre: metadata.genre || null,
                                year: metadata.year || null,
                                duration: null, // Will be extracted during playback
                                coverArt: metadata.picture ? true : false
                            });

                            count++;
                            if (onProgress) onProgress(count, name);

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

                            buffer.push({
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
                            });

                            count++;
                            if (onProgress) onProgress(count, name);
                        }

                        // Batch insert to database
                        if (buffer.length >= this.BATCH_SIZE) {
                            await this.db.bulkAddTracks(buffer);
                            buffer = [];
                        }
                    }
                } else if (entry.kind === 'directory') {
                    await traverse(entry, path + "/" + entry.name);
                }
            }
        };

        EventBus.emit('scan:started');
        await traverse(this.dirHandleRoot, "");

        // Add remaining tracks
        if (buffer.length > 0) {
            await this.db.bulkAddTracks(buffer);
        }

        EventBus.emit('scan:completed', count);
        return count;
    }

    /**
     * Get directory handle
     */
    getDirectoryHandle() {
        return this.dirHandleRoot;
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
