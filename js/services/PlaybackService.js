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
        try {
            // Update queue if provided
            if (queue) {
                this.playbackQueue = queue;
                this.playbackIndex = queue.findIndex(t => t.id === track.id);
            }

            this.currentTrack = track;

            // Get file and create object URL
            const file = await track.handle.getFile();
            this.audio.src = URL.createObjectURL(file);
            await this.audio.play();

            // Emit track started event
            EventBus.emit('track:started', track);

            // Increment play count
            await this.db.incrementPlayCount(track);

            // Extract and update metadata in background
            this.updateTrackMetadata(track, file);

        } catch (error) {
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

        if (tags) {
            // Update Media Session with metadata
            if ('mediaSession' in navigator && tags.picture) {
                const coverUrl = await this.metadata.extractAlbumArt(file);
                if (coverUrl) {
                    navigator.mediaSession.metadata = new MediaMetadata({
                        title: tags.title || track.title,
                        artist: tags.artist || track.artist,
                        album: track.album,
                        artwork: [{ src: coverUrl, sizes: '512x512', type: tags.picture.format }]
                    });

                    EventBus.emit('track:artworkLoaded', coverUrl);
                }
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
