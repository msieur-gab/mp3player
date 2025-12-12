/**
 * TrackList - Custom element for displaying tracks with virtual scrolling
 */
import EventBus from '../utils/EventBus.js';

class TrackList extends HTMLElement {
    constructor() {
        super();
        this.tracks = [];
        this.albumData = null;
        this.currentTrackId = null;
        this.ROW_HEIGHT = 60;
        this.visualizerService = null;

        // Memory leak fix: Track event unsubscribers
        this.eventUnsubscribers = [];

        // Event delegation: Bind handlers once
        this.boundHandleTrackClick = this.handleTrackClick.bind(this);
        this.boundHandleScroll = this.handleScroll.bind(this);
        this.boundHandlePatternClick = this.handlePatternClick.bind(this);
    }

    connectedCallback() {
        this.className = 'scroller-wrapper';
        this.render();
        this.setupEventListeners();
    }

    render() {
        this.innerHTML = `
            <div id="album-header" class="album-header"></div>
            <div id="scroller-container">
                <div id="scroller-phantom"></div>
                <div id="scroller-content"></div>
            </div>
        `;

        this.albumHeader = this.querySelector('#album-header');
        this.container = this.querySelector('#scroller-container');
        this.phantom = this.querySelector('#scroller-phantom');
        this.content = this.querySelector('#scroller-content');
    }

    setupEventListeners() {
        // Memory leak fix: Use event delegation on container (single listener)
        this.content.addEventListener('click', this.boundHandleTrackClick);

        // Scroll handler for virtual scrolling
        this.container.addEventListener('scroll', this.boundHandleScroll);

        // Memory leak fix: Track EventBus subscriptions for cleanup
        this.eventUnsubscribers.push(
            EventBus.on('track:started', (track) => {
                this.currentTrackId = track.id;
                this.renderVisibleTracks();
            })
        );
    }

    /**
     * Event delegation handler for track clicks
     */
    handleTrackClick(e) {
        const card = e.target.closest('.card');
        if (card) {
            const trackId = parseInt(card.dataset.trackId);
            EventBus.emit('track:selected', trackId);
        }
    }

    /**
     * Scroll handler for virtual scrolling
     */
    handleScroll() {
        this.renderVisibleTracks();
    }

    /**
     * Event delegation handler for pattern button clicks
     */
    handlePatternClick(e) {
        const btn = e.target.closest('.pattern-btn');
        if (btn) {
            // Update active state
            this.albumHeader.querySelectorAll('.pattern-btn').forEach(b => {
                b.classList.remove('active');
            });
            btn.classList.add('active');

            // Change pattern
            if (this.visualizerService) {
                this.visualizerService.setPattern(btn.dataset.pattern);
            }
        }
    }

    /**
     * Set visualizer service
     */
    setVisualizerService(visualizerService) {
        this.visualizerService = visualizerService;
    }

    /**
     * Set tracks data with album info and render
     */
    setTracks(tracks, albumData = null) {
        this.tracks = tracks;
        this.albumData = albumData;

        // Render album header with visualizer
        if (albumData) {
            this.renderAlbumHeader();
        } else {
            this.albumHeader.innerHTML = '';
        }

        this.phantom.style.height = `${tracks.length * this.ROW_HEIGHT}px`;
        this.container.scrollTop = 0;
        this.renderVisibleTracks();
    }

    /**
     * Render album header with visualizer and metadata
     */
    renderAlbumHeader() {
        const { name, artist, trackCount, year, genre } = this.albumData;

        const metadata = [];
        if (year) metadata.push(year);
        if (genre) metadata.push(genre);
        if (trackCount) metadata.push(`${trackCount} track${trackCount !== 1 ? 's' : ''}`);

        this.albumHeader.innerHTML = `
            <div class="visualizer-container">
                <canvas id="visualizer-canvas"></canvas>
                <div class="pattern-switcher">
                    <button class="pattern-btn active" data-pattern="needles">NEEDLES</button>
                    <button class="pattern-btn" data-pattern="breath">BREATH</button>
                    <button class="pattern-btn" data-pattern="horizon">HORIZON</button>
                    <button class="pattern-btn" data-pattern="grid">LINES</button>
                    <button class="pattern-btn" data-pattern="mosaic">MOSAIC</button>
                </div>
            </div>
            <div class="album-header-info">
                <h2 class="album-header-title">${name}</h2>
                <p class="album-header-artist">${artist || 'Unknown Artist'}</p>
                ${metadata.length > 0
                    ? `<p class="album-header-meta">${metadata.join(' • ')}</p>`
                    : ''}
            </div>
        `;

        // Initialize visualizer with canvas
        if (this.visualizerService) {
            const canvas = this.albumHeader.querySelector('#visualizer-canvas');
            this.visualizerService.init(canvas);

            // Always enable visualizer for immediate UX feedback
            // (adaptive FPS will use 1 FPS when paused, 30 FPS when playing)
            this.visualizerService.enable();
        }

        // Setup pattern switcher
        this.setupPatternSwitcher();
    }

    /**
     * Setup pattern switcher buttons
     * Memory leak fix: Use event delegation instead of adding listener to each button
     */
    setupPatternSwitcher() {
        const patternContainer = this.albumHeader.querySelector('.pattern-switcher');
        if (patternContainer) {
            patternContainer.addEventListener('click', this.boundHandlePatternClick);
        }
    }

    /**
     * Render only visible tracks (virtual scrolling)
     * Memory leak fix: No individual event listeners - using event delegation
     */
    renderVisibleTracks() {
        const scrollTop = this.container.scrollTop;
        const viewportHeight = this.container.clientHeight;
        const start = Math.floor(scrollTop / this.ROW_HEIGHT);
        const end = Math.min(
            this.tracks.length - 1,
            start + Math.ceil(viewportHeight / this.ROW_HEIGHT) + 3
        );

        let html = '';
        for (let i = start; i <= end; i++) {
            const top = i * this.ROW_HEIGHT;
            const track = this.tracks[i];
            const isActive = this.currentTrackId === track.id;

            html += `
                <div class="card ${isActive ? 'card-active' : ''}"
                     style="top:${top}px"
                     data-track-id="${track.id}">
                    <div class="card-content" style="padding-right: 1rem;">
                        <div class="card-title">${track.title}</div>
                        <div class="card-meta">${track.artist}</div>
                    </div>
                    ${isActive ? '<i class="ph ph-speaker-high card-indicator"></i>' : ''}
                </div>
            `;
        }

        this.content.innerHTML = html;
        // No event listeners added here - handled by event delegation
    }

    /**
     * Show the track list
     */
    show() {
        this.classList.remove('hidden');
    }

    /**
     * Hide the track list
     */
    hide() {
        this.classList.add('hidden');

        // Disable visualizer to save battery when view is hidden
        if (this.visualizerService) {
            this.visualizerService.disable();
            console.log('[TrackList] 🛑 Visualizer disabled on hide');
        }
    }

    /**
     * Cleanup when element is removed from DOM
     * Memory leak fix: Remove all event listeners
     */
    disconnectedCallback() {
        // Remove DOM event listeners
        if (this.content) {
            this.content.removeEventListener('click', this.boundHandleTrackClick);
        }
        if (this.container) {
            this.container.removeEventListener('scroll', this.boundHandleScroll);
        }

        const patternContainer = this.albumHeader?.querySelector('.pattern-switcher');
        if (patternContainer) {
            patternContainer.removeEventListener('click', this.boundHandlePatternClick);
        }

        // Unsubscribe from EventBus
        this.eventUnsubscribers.forEach(unsub => unsub());
        this.eventUnsubscribers = [];

        console.log('[TrackList] 🧹 Cleanup complete');
    }
}

customElements.define('track-list', TrackList);
export default TrackList;
