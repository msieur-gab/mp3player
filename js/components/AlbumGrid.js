/**
 * AlbumGrid - Custom element for displaying albums in a grid
 */
import EventBus from '../utils/EventBus.js';

class AlbumGrid extends HTMLElement {
    constructor() {
        super();
        this.albums = {};
        this.albumKeys = [];
        this.albumCovers = {};
        this.albumDurations = {};

        // Memory leak fix: Track event unsubscribers
        this.eventUnsubscribers = [];

        // Event delegation: Bind handler once
        this.boundHandleAlbumClick = this.handleAlbumClick.bind(this);
    }

    connectedCallback() {
        this.className = 'album-grid';
        this.setupEventListeners();

        // Memory leak fix: Use event delegation (single listener on container)
        this.addEventListener('click', this.boundHandleAlbumClick);
    }

    setupEventListeners() {
        // Memory leak fix: Track EventBus subscription for cleanup
        this.eventUnsubscribers.push(
            EventBus.on('albumCover:extracted', ({ albumName, coverUrl }) => {
                this.albumCovers[albumName] = coverUrl;
                this.updateAlbumCover(albumName, coverUrl);
            })
        );
    }

    /**
     * Event delegation handler for album clicks
     */
    handleAlbumClick(e) {
        const card = e.target.closest('.album-card');
        if (card) {
            EventBus.emit('album:selected', card.dataset.album);
        }
    }

    /**
     * Set albums data and render
     */
    setData(albums, albumKeys, albumCovers = {}, albumDurations = {}) {
        this.albums = albums;
        this.albumKeys = albumKeys;
        this.albumCovers = albumCovers;
        this.albumDurations = albumDurations;
        this.render();
    }

    /**
     * Format duration from seconds to human readable
     * For albums: "45 min", "1h 23m"
     */
    formatAlbumDuration(seconds) {
        if (!seconds || seconds === 0) return '';

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes} min`;
    }

    /**
     * Render album grid
     * Memory leak fix: No individual event listeners - using event delegation
     */
    render() {
        let html = '';

        this.albumKeys.forEach((albumName) => {
            const tracks = this.albums[albumName];
            const count = tracks.length;
            const coverUrl = this.albumCovers[albumName];
            const duration = this.albumDurations[albumName];
            const escapedName = albumName.replace(/'/g, "\\'");

            // Get artist from first track
            const artist = tracks[0]?.artist || 'Unknown Artist';

            // Build metadata line
            const metaParts = [`${count} track${count !== 1 ? 's' : ''}`];
            if (duration) {
                metaParts.push(this.formatAlbumDuration(duration));
            }

            html += `
                <div class="album-card" data-album="${escapedName}">
                    <div class="album-cover">
                        ${coverUrl ? `<img src="${coverUrl}" alt="${albumName}">` : '<i class="ph ph-music-notes"></i>'}
                    </div>
                    <div class="album-info">
                        <div class="album-name">${albumName}</div>
                        <div class="album-artist">${artist}</div>
                        <div class="album-track-count">${metaParts.join(' • ')}</div>
                    </div>
                </div>
            `;
        });

        this.innerHTML = html;
        // No event listeners added here - handled by event delegation
    }

    /**
     * Update specific album cover without full re-render
     * Memory leak fix: Only update the specific album card
     */
    updateAlbumCover(albumName, coverUrl) {
        const escapedName = albumName.replace(/'/g, "\\'");
        const card = this.querySelector(`[data-album="${escapedName}"]`);
        if (card) {
            const coverDiv = card.querySelector('.album-cover');
            if (coverDiv) {
                coverDiv.innerHTML = `<img src="${coverUrl}" alt="${albumName}">`;
            }
        }
    }

    /**
     * Update album duration without full re-render
     * Called when background extraction completes an album
     */
    updateAlbumDuration(albumName, duration) {
        this.albumDurations[albumName] = duration;

        const escapedName = albumName.replace(/'/g, "\\'");
        const card = this.querySelector(`[data-album="${escapedName}"]`);
        if (card) {
            const metaDiv = card.querySelector('.album-track-count');
            if (metaDiv) {
                const count = this.albums[albumName].length;
                const metaParts = [`${count} track${count !== 1 ? 's' : ''}`];
                if (duration) {
                    metaParts.push(this.formatAlbumDuration(duration));
                }
                metaDiv.textContent = metaParts.join(' • ');
            }
        }
    }

    /**
     * Show the grid
     */
    show() {
        this.classList.remove('hidden');
    }

    /**
     * Hide the grid
     */
    hide() {
        this.classList.add('hidden');
    }

    /**
     * Cleanup when element is removed from DOM
     * Memory leak fix: Remove all event listeners
     */
    disconnectedCallback() {
        // Remove DOM event listener
        this.removeEventListener('click', this.boundHandleAlbumClick);

        // Unsubscribe from EventBus
        this.eventUnsubscribers.forEach(unsub => unsub());
        this.eventUnsubscribers = [];

        console.log('[AlbumGrid] 🧹 Cleanup complete');
    }
}

customElements.define('album-grid', AlbumGrid);
export default AlbumGrid;
