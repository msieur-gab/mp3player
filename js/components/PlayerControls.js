/**
 * PlayerControls - Custom element for playback controls
 */
import EventBus from '../utils/EventBus.js';

class PlayerControls extends HTMLElement {
    constructor() {
        super();
        this.currentTrack = null;

        // Memory leak fix: Track event unsubscribers
        this.eventUnsubscribers = [];
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
    }

    render() {
        this.innerHTML = `
            <footer class="player">
                <div class="player-top">
                    <!-- Art & Info -->
                    <div class="player-info">
                        <div class="player-art">
                            <img id="p-art" class="hidden">
                            <div id="p-art-default" class="player-art-default">
                                <i class="ph ph-music-note"></i>
                            </div>
                        </div>
                        <div class="player-details">
                            <h3 id="p-title" class="player-title">Not Playing</h3>
                            <p id="p-artist" class="player-artist">Select a track</p>
                        </div>
                    </div>

                    <!-- Controls (Prev / Play / Next) -->
                    <div class="player-controls">
                        <button id="prevBtn" class="control-btn">
                            <i class="ph-fill ph-skip-back"></i>
                        </button>

                        <button id="playBtn" class="play-btn">
                            <i id="playIcon" class="ph-fill ph-play"></i>
                        </button>

                        <button id="nextBtn" class="control-btn">
                            <i class="ph-fill ph-skip-forward"></i>
                        </button>
                    </div>
                </div>

                <!-- Seek Bar -->
                <div class="seek-bar">
                    <input type="range" id="seek" value="0" max="100">
                </div>
            </footer>
        `;
    }

    setupEventListeners() {
        // Control buttons
        this.querySelector('#playBtn').addEventListener('click', () => {
            EventBus.emit('playback:togglePlayPause');
        });

        this.querySelector('#prevBtn').addEventListener('click', () => {
            EventBus.emit('playback:previous');
        });

        this.querySelector('#nextBtn').addEventListener('click', () => {
            EventBus.emit('playback:next');
        });

        // Seek bar
        this.querySelector('#seek').addEventListener('input', (e) => {
            EventBus.emit('playback:seek', parseFloat(e.target.value));
        });

        // Memory leak fix: Track EventBus subscriptions for cleanup
        this.eventUnsubscribers.push(
            EventBus.on('playback:play', () => {
                this.updatePlayIcon(false);
            }),

            EventBus.on('playback:pause', () => {
                this.updatePlayIcon(true);
            }),

            EventBus.on('playback:timeupdate', ({ progress }) => {
                this.updateSeekBar(progress);
            }),

            EventBus.on('track:started', (track) => {
                this.updateTrackInfo(track);
            }),

            EventBus.on('track:artworkLoaded', (url) => {
                this.updateArtwork(url);
            })
        );
    }

    updatePlayIcon(paused) {
        const icon = this.querySelector('#playIcon');
        icon.className = paused ? 'ph-fill ph-play' : 'ph-fill ph-pause';
    }

    updateSeekBar(progress) {
        const seekBar = this.querySelector('#seek');
        seekBar.value = progress;
    }

    updateTrackInfo(track) {
        this.currentTrack = track;
        this.querySelector('#p-title').innerText = track.title;
        this.querySelector('#p-artist').innerText = track.artist;

        // Reset artwork
        this.querySelector('#p-art').classList.add('hidden');
        this.querySelector('#p-art-default').classList.remove('hidden');
    }

    updateArtwork(url) {
        const img = this.querySelector('#p-art');
        img.src = url;
        img.classList.remove('hidden');
        this.querySelector('#p-art-default').classList.add('hidden');
    }

    /**
     * Cleanup when element is removed from DOM
     * Memory leak fix: Unsubscribe from all events
     */
    disconnectedCallback() {
        // Unsubscribe from EventBus
        this.eventUnsubscribers.forEach(unsub => unsub());
        this.eventUnsubscribers = [];

        console.log('[PlayerControls] 🧹 Cleanup complete');
    }
}

customElements.define('player-controls', PlayerControls);
export default PlayerControls;
