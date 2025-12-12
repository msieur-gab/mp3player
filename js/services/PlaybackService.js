/**
 * PlaybackService - Handles audio playback, queue management, and media controls
 */
import EventBus from '../utils/EventBus.js';

class PlaybackService {
    constructor(metadataService, databaseService) {
        this.metadata = metadataService;
        this.db = databaseService;
        this.audio = null;
        this.currentTrack = null;
        this.playbackQueue = [];
        this.playbackIndex = -1;

        // Memory leak fix: Track object URLs for cleanup
        this.currentAudioUrl = null;
        this.currentArtworkUrl = null;

        // Race condition fix: Track playback requests
        this.playbackRequestId = 0;
        this.currentRequestId = 0;
    }

    /**
     * Initialize playback service
     */
    init() {
        this.audio = document.getElementById('audio');
        this.setupAudioEvents();
        this.setupMediaSession();
        console.log('[PlaybackService] Initialized');
    }

    /**
     * Setup audio element event listeners
     */
    setupAudioEvents() {
        this.audio.onplay = () => {
            EventBus.emit('playback:play');
        };

        this.audio.onpause = () => {
            EventBus.emit('playback:pause');
        };

        this.audio.onended = () => {
            this.playNext();
        };

        this.audio.onloadedmetadata = () => {
            // Extract and save duration if not already set
            if (this.currentTrack && !this.currentTrack.duration && this.audio.duration) {
                const durationInSeconds = Math.round(this.audio.duration);
                this.db.updateTrack(this.currentTrack.id, { duration: durationInSeconds })
                    .then(() => {
                        this.currentTrack.duration = durationInSeconds;
                        console.log(`[PlaybackService] Duration extracted: ${durationInSeconds}s for track ${this.currentTrack.id}`);
                        EventBus.emit('track:durationExtracted', {
                            trackId: this.currentTrack.id,
                            duration: durationInSeconds
                        });
                    })
                    .catch(error => {
                        console.error('[PlaybackService] Error saving duration:', error);
                    });
            }
        };

        this.audio.ontimeupdate = () => {
            if (this.audio.duration) {
                const progress = (this.audio.currentTime / this.audio.duration) * 100;
                EventBus.emit('playback:timeupdate', {
                    currentTime: this.audio.currentTime,
                    duration: this.audio.duration,
                    progress
                });
            }
        };

        this.audio.onerror = (error) => {
            EventBus.emit('playback:error', error);
        };
    }

    /**
     * Setup Media Session API for hardware controls
     */
    setupMediaSession() {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.setActionHandler('play', () => this.play());
            navigator.mediaSession.setActionHandler('pause', () => this.pause());
            navigator.mediaSession.setActionHandler('previoustrack', () => this.playPrev());
            navigator.mediaSession.setActionHandler('nexttrack', () => this.playNext());
        }
    }

    /**
     * Play a track
     * @param {Object} track - Track object with handle
     * @param {Array} queue - Optional playback queue
     */
    async playTrack(track, queue = null) {
        // Race condition fix: Generate unique request ID
        const requestId = ++this.playbackRequestId;
        this.currentRequestId = requestId;

        let objectUrl = null;

        try {
            // Update queue if provided
            if (queue) {
                this.playbackQueue = queue;
                this.playbackIndex = queue.findIndex(t => t.id === track.id);
            }

            this.currentTrack = track;

            // Get file and create object URL
            const file = await track.handle.getFile();

            // Race condition fix: Check if still the active request
            if (this.currentRequestId !== requestId) {
                console.log('[PlaybackService] Request superseded, aborting');
                return;
            }

            // Memory leak fix: Revoke old audio URL before creating new one
            if (this.currentAudioUrl) {
                URL.revokeObjectURL(this.currentAudioUrl);
            }

            objectUrl = URL.createObjectURL(file);
            this.currentAudioUrl = objectUrl;
            this.audio.src = objectUrl;

            await this.audio.play();

            // Race condition fix: Check again after async operation
            if (this.currentRequestId !== requestId) {
                console.log('[PlaybackService] Request superseded after play, aborting');
                return;
            }

            // Emit track started event
            EventBus.emit('track:started', track);

            // Increment play count
            await this.db.incrementPlayCount(track);

            // Extract and update metadata in background
            this.updateTrackMetadata(track, file).catch(error => {
                console.error('[PlaybackService] Metadata update failed:', error);
            });

        } catch (error) {
            // Error cleanup: Revoke object URL if created
            if (objectUrl && this.currentRequestId === requestId) {
                URL.revokeObjectURL(objectUrl);
                this.currentAudioUrl = null;
            }

            console.error('[PlaybackService] Error playing track:', error);
            EventBus.emit('playback:error', error);

            if (error.name === 'NotAllowedError') {
                EventBus.emit('permission:needed');
            }
        }
    }

    /**
     * Update track metadata and album art
     * @param {Object} track - Track object
     * @param {File} file - Audio file
     */
    async updateTrackMetadata(track, file) {
        const { tags } = await this.metadata.updateTrackMetadata(track, file);

        if (tags && 'mediaSession' in navigator) {
            let coverUrl = null;

            // Check database first for cached cover (fast)
            const cachedCover = await this.db.getCover(track.album, track.artist);
            if (cachedCover) {
                coverUrl = URL.createObjectURL(cachedCover);
            } else if (tags.picture) {
                // Extract and compress if not cached (slow)
                const extracted = await this.metadata.extractAlbumArt(file);
                if (extracted) {
                    const compressed = await this.metadata.compressCover(extracted);
                    await this.db.saveCover(track.album, track.artist, compressed);
                    coverUrl = URL.createObjectURL(compressed);
                }
            }

            if (coverUrl) {
                // Memory leak fix: Revoke old artwork URL before setting new one
                if (this.currentArtworkUrl) {
                    URL.revokeObjectURL(this.currentArtworkUrl);
                }
                this.currentArtworkUrl = coverUrl;

                navigator.mediaSession.metadata = new MediaMetadata({
                    title: tags.title || track.title,
                    artist: tags.artist || track.artist,
                    album: track.album,
                    artwork: [{ src: coverUrl, sizes: '512x512', type: 'image/webp' }]
                });

                EventBus.emit('track:artworkLoaded', coverUrl);
            }
        }
    }

    /**
     * Play audio
     */
    play() {
        this.audio.play();
    }

    /**
     * Pause audio
     */
    pause() {
        this.audio.pause();
    }

    /**
     * Toggle play/pause
     */
    togglePlayPause() {
        if (this.audio.paused) {
            this.play();
        } else {
            this.pause();
        }
    }

    /**
     * Play next track in queue
     */
    playNext() {
        if (this.playbackQueue.length === 0 || this.playbackIndex === -1) return;
        if (this.playbackIndex < this.playbackQueue.length - 1) {
            this.playbackIndex++;
            const nextTrack = this.playbackQueue[this.playbackIndex];
            this.playTrack(nextTrack);
        }
    }

    /**
     * Play previous track in queue
     */
    playPrev() {
        if (this.playbackQueue.length === 0 || this.playbackIndex === -1) return;
        if (this.playbackIndex > 0) {
            this.playbackIndex--;
            const prevTrack = this.playbackQueue[this.playbackIndex];
            this.playTrack(prevTrack);
        }
    }

    /**
     * Seek to position
     * @param {number} percent - Position as percentage (0-100)
     */
    seek(percent) {
        if (this.audio.duration) {
            this.audio.currentTime = (percent / 100) * this.audio.duration;
        }
    }

    /**
     * Get current track
     */
    getCurrentTrack() {
        return this.currentTrack;
    }

    /**
     * Get playback state
     */
    getState() {
        return {
            track: this.currentTrack,
            queue: this.playbackQueue,
            index: this.playbackIndex,
            paused: this.audio.paused,
            currentTime: this.audio.currentTime,
            duration: this.audio.duration
        };
    }
}

export default PlaybackService;
