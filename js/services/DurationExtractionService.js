/**
 * DurationExtractionService - Background duration extraction for audio files
 * Optimized for large libraries (2000-5000 tracks) with careful performance management
 */
import EventBus from '../utils/EventBus.js';

class DurationExtractionService {
    constructor(databaseService, metadataService, permissionManager) {
        this.db = databaseService;
        this.metadata = metadataService;
        this.permissions = permissionManager;

        this.isExtracting = false;
        this.isPaused = false;
        this.queue = [];
        this.currentBatch = [];
        this.extracted = 0;
        this.failed = 0;

        // Performance settings for large libraries
        this.BATCH_SIZE = 3; // Process 3 tracks concurrently
        this.BATCH_DELAY = 200; // 200ms pause between batches

        this.setupVisibilityHandler();
    }

    /**
     * Extract durations for all tracks missing duration data
     * @param {Array} tracks - Tracks needing duration extraction
     * @returns {Promise} Resolves when extraction is complete
     */
    async extractMissingDurations(tracks) {
        if (this.isExtracting) {
            console.log('[DurationExtractor] Already extracting, canceling current operation');
            this.cancel();
        }

        // Filter out hidden files and system files
        this.queue = tracks.filter(track => {
            const filename = track.path.split('/').pop();
            return !filename.startsWith('.') && !filename.startsWith('._');
        });
        this.extracted = 0;
        this.failed = 0;
        this.isExtracting = true;
        this.isPaused = false;

        console.log(`[DurationExtractor] Starting extraction for ${this.queue.length} tracks`);

        // Process batches until queue is empty
        while (this.queue.length > 0 && this.isExtracting) {
            if (this.isPaused) {
                // Wait for resume
                await this.waitForResume();
            }

            await this.processBatch();

            // Pause between batches for UI breathing room
            if (this.queue.length > 0) {
                await this.delay(this.BATCH_DELAY);
            }
        }

        const total = this.extracted + this.failed;
        console.log(`[DurationExtractor] Extraction complete: ${this.extracted} extracted, ${this.failed} failed out of ${total} tracks`);

        EventBus.emit('duration:extractionComplete', {
            total,
            extracted: this.extracted,
            failed: this.failed
        });

        this.isExtracting = false;
    }

    /**
     * Process a single batch of tracks
     */
    async processBatch() {
        // Use requestIdleCallback for non-blocking execution
        await this.scheduleWork(() => {
            return this.extractBatch();
        });
    }

    /**
     * Extract durations for a batch of tracks concurrently
     */
    async extractBatch() {
        const batch = this.queue.splice(0, this.BATCH_SIZE);

        const promises = batch.map(track => this.extractDurationForTrack(track));
        await Promise.all(promises);
    }

    /**
     * Extract duration for a single track
     * @param {Object} track - Track object with file handle
     */
    async extractDurationForTrack(track) {
        try {
            // Get file handle from path
            const file = await this.getFileFromPath(track.path);
            if (!file) {
                console.warn(`[DurationExtractor] Could not access file: ${track.path}`);
                this.failed++;
                return;
            }

            // Extract duration using MetadataService
            const duration = await this.metadata.extractDuration(file);

            if (duration) {
                // Save to database
                await this.db.updateTrack(track.id, { duration });

                this.extracted++;

                // Emit event for UI update
                EventBus.emit('duration:trackExtracted', {
                    trackId: track.id,
                    duration,
                    progress: {
                        extracted: this.extracted,
                        failed: this.failed,
                        remaining: this.queue.length
                    }
                });
            } else {
                console.warn(`[DurationExtractor] Failed to extract duration for: ${track.title}`);
                this.failed++;
            }
        } catch (error) {
            console.error(`[DurationExtractor] Error extracting duration for ${track.title}:`, error);
            this.failed++;
        }
    }

    /**
     * Get File object from track path using FileSystem API
     */
    async getFileFromPath(path) {
        try {
            // Path format: /Album/Track.mp3
            const pathParts = path.split('/').filter(p => p);

            // Get root directory handle from PermissionManager
            const rootHandle = await this.permissions.getHandle();
            if (!rootHandle) {
                console.warn('[DurationExtractor] No root directory handle');
                return null;
            }

            // Navigate to file
            let currentHandle = rootHandle;
            for (let i = 0; i < pathParts.length - 1; i++) {
                currentHandle = await currentHandle.getDirectoryHandle(pathParts[i]);
            }

            const fileName = pathParts[pathParts.length - 1];
            const fileHandle = await currentHandle.getFileHandle(fileName);
            const file = await fileHandle.getFile();

            return file;
        } catch (error) {
            console.error('[DurationExtractor] Error accessing file:', error);
            return null;
        }
    }

    /**
     * Schedule work using requestIdleCallback or fallback to setTimeout
     */
    scheduleWork(callback) {
        return new Promise((resolve) => {
            if ('requestIdleCallback' in window) {
                requestIdleCallback(async () => {
                    await callback();
                    resolve();
                });
            } else {
                setTimeout(async () => {
                    await callback();
                    resolve();
                }, 100);
            }
        });
    }

    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Wait for resume (when paused)
     */
    async waitForResume() {
        while (this.isPaused && this.isExtracting) {
            await this.delay(500);
        }
    }

    /**
     * Pause extraction (e.g., when tab is hidden)
     */
    pause() {
        if (this.isExtracting && !this.isPaused) {
            console.log('[DurationExtractor] Pausing extraction');
            this.isPaused = true;
        }
    }

    /**
     * Resume extraction
     */
    resume() {
        if (this.isExtracting && this.isPaused) {
            console.log('[DurationExtractor] Resuming extraction');
            this.isPaused = false;
        }
    }

    /**
     * Cancel ongoing extraction
     */
    cancel() {
        if (this.isExtracting) {
            console.log('[DurationExtractor] Canceling extraction');
            this.isExtracting = false;
            this.isPaused = false;
            this.queue = [];
        }
    }

    /**
     * Setup visibility handler to pause when tab is hidden
     */
    setupVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pause();
            } else {
                this.resume();
            }
        });
    }
}

export default DurationExtractionService;
