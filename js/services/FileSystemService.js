/**
 * FileSystemService - Handles SD card/file system access and scanning
 */
import EventBus from '../utils/EventBus.js';

class FileSystemService {
    constructor(databaseService) {
        this.db = databaseService;
        this.dirHandleRoot = null;
        this.BATCH_SIZE = 500;
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
     * Scan directory for music files
     * @param {function} onProgress - Progress callback (count)
     */
    async scanDirectory(onProgress) {
        if (!this.dirHandleRoot) {
            throw new Error('No directory handle available');
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
                        // Use parent folder name as initial "Album"
                        const pathParts = path.split('/');
                        const folderName = pathParts[pathParts.length - 1] || "Unknown Album";

                        // Extract track number from filename (e.g., "01 - Song.mp3" -> 1)
                        const trackMatch = name.match(/^(\d+)/);
                        const trackNumber = trackMatch ? parseInt(trackMatch[1], 10) : null;

                        buffer.push({
                            title: name, // Fallback: Filename
                            handle: entry,
                            path: path + "/" + name,
                            album: folderName,
                            artist: "Unknown Artist",
                            trackNumber: trackNumber
                        });

                        if (buffer.length >= this.BATCH_SIZE) {
                            await this.db.bulkAddTracks(buffer);
                            count += buffer.length;
                            if (onProgress) onProgress(count);
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
            count += buffer.length;
            if (onProgress) onProgress(count);
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
}

export default FileSystemService;
