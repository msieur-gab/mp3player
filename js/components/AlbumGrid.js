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
    }

    connectedCallback() {
        this.className = 'album-grid';
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Listen for album cover updates
        EventBus.on('albumCover:extracted', ({ albumName, coverUrl }) => {
            this.albumCovers[albumName] = coverUrl;
            this.render();
        });
    }

    /**
     * Set albums data and render
     */
    setData(albums, albumKeys, albumCovers = {}) {
        this.albums = albums;
        this.albumKeys = albumKeys;
        this.albumCovers = albumCovers;
        this.render();
    }

    /**
     * Render album grid
     */
    render() {
        let html = '';

        this.albumKeys.forEach((albumName) => {
            const count = this.albums[albumName].length;
            const coverUrl = this.albumCovers[albumName];
            const escapedName = albumName.replace(/'/g, "\\'");

            html += `
                <div class="album-card" data-album="${escapedName}">
                    <div class="album-cover">
                        ${coverUrl ? `<img src="${coverUrl}" alt="${albumName}">` : '<i class="ph ph-music-notes"></i>'}
                    </div>
                    <div class="album-info">
                        <div class="album-name">${albumName}</div>
                        <div class="album-track-count">${count} track${count !== 1 ? 's' : ''}</div>
                    </div>
                </div>
            `;
        });

        this.innerHTML = html;

        // Add click handlers after rendering
        this.querySelectorAll('.album-card').forEach(card => {
            card.addEventListener('click', () => {
                const albumName = card.dataset.album;
                EventBus.emit('album:selected', albumName);
            });
        });
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
}

customElements.define('album-grid', AlbumGrid);
export default AlbumGrid;
