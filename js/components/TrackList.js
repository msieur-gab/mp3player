/**
 * TrackList - Custom element for displaying tracks with virtual scrolling
 */
import EventBus from '../utils/EventBus.js';

class TrackList extends HTMLElement {
    constructor() {
        super();
        this.tracks = [];
        this.currentTrackId = null;
        this.ROW_HEIGHT = 60;
    }

    connectedCallback() {
        this.className = 'scroller-wrapper';
        this.render();
        this.setupEventListeners();
    }

    render() {
        this.innerHTML = `
            <div id="scroller-container">
                <div id="scroller-phantom"></div>
                <div id="scroller-content"></div>
            </div>
        `;

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
     * Set tracks data and render
     */
    setTracks(tracks) {
        this.tracks = tracks;
        this.phantom.style.height = `${tracks.length * this.ROW_HEIGHT}px`;
        this.container.scrollTop = 0;
        this.renderVisibleTracks();
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
    }
}

customElements.define('track-list', TrackList);
export default TrackList;
