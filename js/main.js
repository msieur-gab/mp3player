/**
 * Main Application Entry Point
 * Initializes services and manages application state
 */
import EventBus from './utils/EventBus.js';
import DatabaseService from './services/DatabaseService.js';
import FileSystemService from './services/FileSystemService.js';
import MetadataService from './services/MetadataService.js';
import PlaybackService from './services/PlaybackService.js';
import ThemeService from './services/ThemeService.js';

class MusicPlayerApp {
    constructor() {
        // Initialize services
        this.db = new DatabaseService();
        this.fs = new FileSystemService(this.db);
        this.metadata = new MetadataService(this.db);
        this.playback = new PlaybackService(this.metadata);
        this.theme = new ThemeService();

        // Application state
        this.allTracks = [];
        this.albums = {};
        this.albumKeys = [];
        this.currentView = 'ALBUMS';
        this.activeAlbumName = null;
        this.viewList = [];

        // UI elements
        this.elements = {};
    }

    /**
     * Initialize the application
     */
    async init() {
        console.log('[App] Initializing...');

        // Cache UI elements
        this.cacheElements();

        // Initialize services
        await this.db.init();
        await this.fs.init();
        this.playback.init();
        this.theme.init();

        // Setup event listeners
        this.setupEventListeners();
        this.setupServiceWorker();

        // Load library
        await this.loadLibrary();

        console.log('[App] Ready');
    }

    /**
     * Cache DOM elements
     */
    cacheElements() {
        this.elements = {
            // Header
            backBtn: document.getElementById('backBtn'),
            branding: document.getElementById('header-branding'),
            headerTitle: document.getElementById('header-title'),
            status: document.getElementById('status'),
            themeBtn: document.getElementById('themeBtn'),
            themeIcon: document.getElementById('themeIcon'),
            installBtn: document.getElementById('installBtn'),
            scanBtn: document.getElementById('scanBtn'),

            // Banners
            updateBanner: document.getElementById('update-banner'),
            permBanner: document.getElementById('perm-banner'),

            // Main content
            albumGrid: document.getElementById('album-grid-container'),
            scrollerWrapper: document.getElementById('scroller-wrapper'),
            scrollerContainer: document.getElementById('scroller-container'),
            scrollerContent: document.getElementById('scroller-content'),
            scrollerPhantom: document.getElementById('scroller-phantom'),
            emptyState: document.getElementById('empty-state'),

            // Player
            playerArt: document.getElementById('p-art'),
            playerArtDefault: document.getElementById('p-art-default'),
            playerTitle: document.getElementById('p-title'),
            playerArtist: document.getElementById('p-artist'),
            playBtn: document.getElementById('playBtn'),
            playIcon: document.getElementById('playIcon'),
            prevBtn: document.getElementById('prevBtn'),
            nextBtn: document.getElementById('nextBtn'),
            seekBar: document.getElementById('seek'),

            // Debug
            logPanel: document.getElementById('log-panel')
        };
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Header buttons
        this.elements.backBtn.onclick = () => this.switchView('ALBUMS');
        this.elements.themeBtn.onclick = () => this.handleThemeToggle();
        this.elements.scanBtn.onclick = () => this.handleScan();

        // Player controls
        this.elements.playBtn.onclick = () => this.playback.togglePlayPause();
        this.elements.prevBtn.onclick = () => this.playback.playPrev();
        this.elements.nextBtn.onclick = () => this.playback.playNext();
        this.elements.seekBar.oninput = (e) => this.playback.seek(e.target.value);

        // Permission banner
        this.elements.permBanner.onclick = async () => {
            if (await this.fs.requestPermission()) {
                this.elements.permBanner.classList.add('hidden');
            }
        };

        // EventBus listeners
        EventBus.on('theme:changed', (theme) => this.updateThemeIcon(theme));
        EventBus.on('playback:play', () => this.updatePlayIcon(false));
        EventBus.on('playback:pause', () => this.updatePlayIcon(true));
        EventBus.on('playback:timeupdate', ({ progress }) => {
            this.elements.seekBar.value = progress;
        });
        EventBus.on('track:started', (track) => this.updatePlayerUI(track));
        EventBus.on('track:artworkLoaded', (url) => this.updatePlayerArt(url));
        EventBus.on('permission:needed', () => {
            this.elements.permBanner.classList.remove('hidden');
        });
        EventBus.on('albumCover:extracted', () => {
            if (this.currentView === 'ALBUMS') this.renderAlbumGrid();
        });
        EventBus.on('scan:started', () => {
            this.elements.scanBtn.innerText = 'Scanning...';
            this.elements.scanBtn.disabled = true;
        });
        EventBus.on('scan:completed', async (count) => {
            this.elements.scanBtn.innerText = 'Scan';
            this.elements.scanBtn.disabled = false;
            await this.loadLibrary();
        });

        // Scroller
        this.elements.scrollerContainer.onscroll = () => this.renderTrackList();
    }

    /**
     * Setup service worker with update detection
     */
    setupServiceWorker() {
        let updateWaiting = false;
        let registration = null;

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js')
                .then((reg) => {
                    registration = reg;
                    console.log('[App] Service worker registered');

                    // Check for updates every 60 seconds
                    setInterval(() => reg.update(), 60000);

                    // Detect waiting service worker
                    reg.addEventListener('updatefound', () => {
                        const newWorker = reg.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                updateWaiting = true;
                                this.showUpdateBanner(registration);
                            }
                        });
                    });

                    // Handle controller change
                    navigator.serviceWorker.addEventListener('controllerchange', () => {
                        if (updateWaiting) window.location.reload();
                    });
                })
                .catch((err) => console.error('[App] SW registration failed:', err));
        }

        // PWA install prompt
        let deferredPrompt;
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            this.elements.installBtn.classList.remove('hidden');
        });

        this.elements.installBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            deferredPrompt = null;
            this.elements.installBtn.classList.add('hidden');
        });
    }

    /**
     * Show update banner
     */
    showUpdateBanner(registration) {
        this.elements.updateBanner.classList.remove('hidden');
        this.elements.updateBanner.onclick = () => {
            if (registration && registration.waiting) {
                registration.waiting.postMessage('SKIP_WAITING');
            }
        };
    }

    /**
     * Handle scan button click
     */
    async handleScan() {
        if (!window.showDirectoryPicker) {
            alert('File System Access API not supported. Enable flags.');
            return;
        }

        try {
            await this.fs.requestDirectoryAccess();
            await this.fs.scanDirectory((count) => {
                this.elements.status.innerText = `Indexed ${count}`;
            });
        } catch (error) {
            console.error('[App] Scan error:', error);
        }
    }

    /**
     * Handle theme toggle
     */
    handleThemeToggle() {
        this.theme.toggleTheme();
    }

    /**
     * Update theme icon
     */
    updateThemeIcon(theme) {
        if (theme === 'dark') {
            this.elements.themeIcon.className = 'ph ph-moon';
        } else {
            this.elements.themeIcon.className = 'ph ph-sun';
        }
    }

    /**
     * Update play icon
     */
    updatePlayIcon(paused) {
        this.elements.playIcon.className = paused ? 'ph-fill ph-play' : 'ph-fill ph-pause';
    }

    /**
     * Update player UI
     */
    updatePlayerUI(track) {
        this.elements.playerTitle.innerText = track.title;
        this.elements.playerArtist.innerText = track.artist;
        this.elements.playerArt.classList.add('hidden');
        this.elements.playerArtDefault.classList.remove('hidden');

        // Re-render track list to show active track
        if (this.currentView === 'TRACKS') this.renderTrackList();
    }

    /**
     * Update player artwork
     */
    updatePlayerArt(url) {
        this.elements.playerArt.src = url;
        this.elements.playerArt.classList.remove('hidden');
        this.elements.playerArtDefault.classList.add('hidden');
    }

    /**
     * Load music library
     */
    async loadLibrary() {
        try {
            this.allTracks = await this.db.getAllTracks();
            this.elements.status.innerText = `${this.allTracks.length} tracks`;

            if (this.allTracks.length > 0) {
                this.elements.emptyState.classList.add('hidden');
                this.groupAlbums();
                this.switchView('ALBUMS');
                // Extract album covers in background
                this.metadata.extractAlbumCovers(this.albums);
            }
        } catch (error) {
            console.error('[App] Error loading library:', error);
        }
    }

    /**
     * Group tracks by album
     */
    groupAlbums() {
        this.albums = {};
        this.allTracks.forEach(t => {
            const alb = t.album || "Unknown";
            if (!this.albums[alb]) this.albums[alb] = [];
            this.albums[alb].push(t);
        });
        this.albumKeys = Object.keys(this.albums).sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true })
        );
    }

    /**
     * Switch between views
     */
    switchView(mode, albumName = null, autoPlay = false) {
        this.currentView = mode;

        if (mode === 'ALBUMS') {
            this.activeAlbumName = null;
            this.elements.backBtn.classList.add('hidden');
            this.elements.branding.classList.remove('hidden');
            this.elements.headerTitle.classList.add('hidden');
            this.elements.albumGrid.classList.remove('hidden');
            this.elements.scrollerWrapper.classList.add('hidden');
            this.renderAlbumGrid();

        } else if (mode === 'TRACKS') {
            this.activeAlbumName = albumName;
            this.viewList = this.albums[albumName].sort((a, b) => {
                if (a.trackNumber != null && b.trackNumber != null) {
                    return a.trackNumber - b.trackNumber;
                }
                if (a.trackNumber != null) return -1;
                if (b.trackNumber != null) return 1;
                return a.path.localeCompare(b.path, undefined, { numeric: true });
            });

            this.elements.backBtn.classList.remove('hidden');
            this.elements.branding.classList.add('hidden');
            this.elements.headerTitle.innerText = albumName;
            this.elements.headerTitle.classList.remove('hidden');
            this.elements.albumGrid.classList.add('hidden');
            this.elements.scrollerWrapper.classList.remove('hidden');

            this.elements.scrollerContainer.scrollTop = 0;
            this.initScroller();

            // Auto-play first track
            if (autoPlay && this.viewList.length > 0) {
                setTimeout(() => this.playTrack(this.viewList[0].id), 100);
            }
        }
    }

    /**
     * Render album grid
     */
    renderAlbumGrid() {
        let html = '';
        this.albumKeys.forEach((albumName) => {
            const count = this.albums[albumName].length;
            const coverUrl = this.metadata.getAlbumCover(albumName);
            const escapedName = albumName.replace(/'/g, "\\'");

            html += `
                <div class="album-card" onclick="app.switchView('TRACKS', '${escapedName}', true)">
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
        this.elements.albumGrid.innerHTML = html;
    }

    /**
     * Initialize virtual scroller
     */
    initScroller() {
        const ROW_HEIGHT = 60;
        this.elements.scrollerPhantom.style.height = `${this.viewList.length * ROW_HEIGHT}px`;
        this.renderTrackList();
    }

    /**
     * Render track list (virtual scroller)
     */
    renderTrackList() {
        const ROW_HEIGHT = 60;
        const scrollTop = this.elements.scrollerContainer.scrollTop;
        const viewportHeight = this.elements.scrollerContainer.clientHeight;
        const start = Math.floor(scrollTop / ROW_HEIGHT);
        const end = Math.min(this.viewList.length - 1, start + Math.ceil(viewportHeight / ROW_HEIGHT) + 3);

        let html = '';
        for (let i = start; i <= end; i++) {
            const top = i * ROW_HEIGHT;
            const t = this.viewList[i];
            const currentTrack = this.playback.getCurrentTrack();
            const isActive = currentTrack && currentTrack.id === t.id;

            html += `
                <div class="card ${isActive ? 'card-active' : ''}"
                     style="top:${top}px"
                     onclick="app.playTrack(${t.id})">
                    <div class="card-content" style="padding-right: 1rem;">
                        <div class="card-title">${t.title}</div>
                        <div class="card-meta">${t.artist}</div>
                    </div>
                    ${isActive ? '<i class="ph ph-speaker-high card-indicator"></i>' : ''}
                </div>
            `;
        }
        this.elements.scrollerContent.innerHTML = html;
    }

    /**
     * Play a track by ID
     */
    async playTrack(id) {
        const track = this.allTracks.find(t => t.id === id);
        if (!track) return;

        // Update queue if in track view
        if (this.currentView === 'TRACKS') {
            await this.playback.playTrack(track, this.viewList);
        } else {
            await this.playback.playTrack(track);
        }
    }
}

// Initialize app when DOM is ready
const app = new MusicPlayerApp();
window.app = app; // Expose for onclick handlers

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

// Logger utility
window.toggleLogs = () => {
    const panel = document.getElementById('log-panel');
    panel.classList.toggle('expanded');
};
