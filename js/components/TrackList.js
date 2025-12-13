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
        this.databaseService = null;
        this.playCountCache = new Map(); // Cache play counts by trackKey

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
     * Set database service
     */
    setDatabaseService(databaseService) {
        this.databaseService = databaseService;
    }

    /**
     * Set tracks data with album info and render
     */
    async setTracks(tracks, albumData = null) {
        this.tracks = tracks;
        this.albumData = albumData;

        // Load play counts for all tracks
        if (this.databaseService) {
            await this.loadPlayCounts();
        }

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
     * Load play counts for all tracks using trackKey
     */
    async loadPlayCounts() {
        this.playCountCache.clear();

        for (const track of this.tracks) {
            const trackKey = this.databaseService.generateTrackKey(track);
            const count = await this.databaseService.getPlayCount(track);
            if (count > 0) {
                this.playCountCache.set(trackKey, count);
            }
        }
    }

    /**
     * Format duration from seconds to MM:SS
     */
    formatDuration(seconds) {
        if (!seconds || seconds === 0) return '';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
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
                    <button class="pattern-btn" data-pattern="digital">DIGITAL</button>
                    <button class="pattern-btn" data-pattern="vibe">VIBE</button>
                    <button class="pattern-btn" data-pattern="arcs">ARCS</button>
                    <button class="pattern-btn" data-pattern="rays">RAYS</button>
                    <button class="pattern-btn" data-pattern="breath">BREATH</button>
                    <button class="pattern-btn" data-pattern="horizon">HORIZON</button>
                    <button class="pattern-btn" data-pattern="grid">LINES</button>
                    <button class="pattern-btn" data-pattern="mosaic">MOSAIC</button>
                    <button class="pattern-btn" data-pattern="flow">FLOW</button>
                    <button class="pattern-btn" data-pattern="shift">SHIFT</button>
                    <button class="pattern-btn" data-pattern="flux">FLUX</button>
                    <button class="pattern-btn" data-pattern="pulse">PULSE</button>
                    <button class="pattern-btn" data-pattern="rain">RAIN</button>
                    <button class="pattern-btn" data-pattern="contour">CONTOUR</button>
                    <button class="pattern-btn" data-pattern="weave">WEAVE</button>
                    <button class="pattern-btn" data-pattern="strings">STRINGS</button>
                    <button class="pattern-btn" data-pattern="strata">STRATA</button>
                    <button class="pattern-btn" data-pattern="code">CODE</button>
                    <button class="pattern-btn" data-pattern="cascade">CASCADE</button>
                    <button class="pattern-btn" data-pattern="scan">SCAN</button>
                    <button class="pattern-btn" data-pattern="ribbonOrbit">RIBBON ORBIT</button>
                    <button class="pattern-btn" data-pattern="latticeDrift">LATTICE DRIFT</button>
                    <button class="pattern-btn" data-pattern="echoStrands">ECHO STRANDS</button>
                    <button class="pattern-btn" data-pattern="interferenceField">INTERFERENCE</button>
                    <button class="pattern-btn" data-pattern="pulseScan">PULSE SCAN</button>
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

            // Get play count from cache using trackKey
            const trackKey = this.databaseService ? this.databaseService.generateTrackKey(track) : null;
            const playCount = trackKey ? (this.playCountCache.get(trackKey) || 0) : 0;

            // Format duration
            const duration = this.formatDuration(track.duration);

            // Build metadata line: duration • play count
            const metaParts = [];
            if (duration) metaParts.push(duration);
            if (playCount > 0) metaParts.push(`${playCount} plays`);
            const metaLine = metaParts.length > 0 ? metaParts.join(' • ') : '';

            html += `
                <div class="card ${isActive ? 'card-active' : ''}"
                     style="top:${top}px"
                     data-track-id="${track.id}">
                    <div class="card-content" style="padding-right: 1rem;">
                        <div class="card-title">${track.title}</div>
                        <div class="card-meta">${track.artist}${metaLine ? ` • ${metaLine}` : ''}</div>
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
