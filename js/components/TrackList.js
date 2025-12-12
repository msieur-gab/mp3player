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
        // Scroll handler for virtual scrolling
        this.container.addEventListener('scroll', () => {
            this.renderVisibleTracks();
        });

        // Listen for track changes
        EventBus.on('track:started', (track) => {
            this.currentTrackId = track.id;
            this.renderVisibleTracks();
        });
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
     */
    setupPatternSwitcher() {
        const buttons = this.albumHeader.querySelectorAll('.pattern-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const pattern = btn.dataset.pattern;
                if (this.visualizerService) {
                    this.visualizerService.setPattern(pattern);
                }
            });
        });
    }

    /**
     * Render only visible tracks (virtual scrolling)
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

        // Add click handlers after rendering
        this.content.querySelectorAll('.card').forEach(card => {
            card.addEventListener('click', () => {
                const trackId = parseInt(card.dataset.trackId);
                EventBus.emit('track:selected', trackId);
            });
        });
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
}

customElements.define('track-list', TrackList);
export default TrackList;
