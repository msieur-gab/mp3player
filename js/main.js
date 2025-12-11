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

// Import components
import './components/AppHeader.js';
import './components/PlayerControls.js';
import './components/AlbumGrid.js';
import './components/TrackList.js';

class MusicPlayerApp {
    constructor() {
        // Initialize services
        this.db = new DatabaseService();
        this.metadata = new MetadataService(this.db);
        this.fs = new FileSystemService(this.db, this.metadata);
        this.playback = new PlaybackService(this.metadata, this.db);
        this.theme = new ThemeService();

        // Application state
        this.allTracks = [];
        this.albums = {};
        this.albumKeys = [];
        this.currentView = 'ALBUMS';
        this.activeAlbumName = null;
        this.viewList = [];

        // Components
        this.components = {};
    }

    /**
     * Initialize the application
     */
    async init() {
        console.log('[App] Initializing...');

        // Wait for custom elements to be defined
        await Promise.all([
            customElements.whenDefined('app-header'),
            customElements.whenDefined('player-controls'),
            customElements.whenDefined('album-grid'),
            customElements.whenDefined('track-list')
        ]);

        // Get component references
        this.components = {
            header: document.querySelector('app-header'),
            player: document.querySelector('player-controls'),
            albumGrid: document.querySelector('album-grid'),
            trackList: document.querySelector('track-list')
        };

        // Get permission banner reference
        this.permissionBanner = document.getElementById('perm-banner');
        if (this.permissionBanner) {
            this.permissionBanner.addEventListener('click', () => {
                this.handlePermissionRequest();
            });
        }

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
     * Setup all event listeners
     */
    setupEventListeners() {
        // Navigation events
        EventBus.on('navigation:back', () => this.switchView('ALBUMS'));
        EventBus.on('album:selected', (albumName) => this.switchView('TRACKS', albumName, true));
        EventBus.on('track:selected', (trackId) => this.playTrack(trackId));

        // Theme events
        EventBus.on('theme:toggle', () => this.theme.toggleTheme());

        // Scan events
        EventBus.on('scan:request', () => this.handleScan());

        // Playback events
        EventBus.on('playback:togglePlayPause', () => this.playback.togglePlayPause());
        EventBus.on('playback:previous', () => this.playback.playPrev());
        EventBus.on('playback:next', () => this.playback.playNext());
        EventBus.on('playback:seek', (percent) => this.playback.seek(percent));

        // Library events
        EventBus.on('scan:completed', async () => {
            await this.loadLibrary();
        });

        // Permission events
        EventBus.on('permission:needed', () => this.showPermissionBanner());
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
            this.components.header?.showInstallButton();
        });

        const installBtn = this.components.header?.getInstallButton();
        if (installBtn) {
            installBtn.addEventListener('click', async () => {
                if (!deferredPrompt) return;
                deferredPrompt.prompt();
                await deferredPrompt.userChoice;
                deferredPrompt = null;
                this.components.header?.hideInstallButton();
            });
        }
    }

    /**
     * Show update banner
     */
    showUpdateBanner(registration) {
        const banner = document.getElementById('update-banner');
        banner.classList.remove('hidden');
        banner.onclick = () => {
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
            await this.fs.scanDirectory((count, currentFile) => {
                EventBus.emit('scan:progress', { count, currentFile });
            });
        } catch (error) {
            console.error('[App] Scan error:', error);
        }
    }

    /**
     * Load music library
     */
    async loadLibrary() {
        try {
            this.allTracks = await this.db.getAllTracks();
            const emptyState = document.getElementById('empty-state');

            if (this.allTracks.length > 0) {
                emptyState.classList.add('hidden');
                this.groupAlbums();
                this.switchView('ALBUMS');
                EventBus.emit('library:loaded', this.allTracks.length);
                // Extract album covers in background
                this.metadata.extractAlbumCovers(this.albums);
            } else {
                emptyState.classList.remove('hidden');
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
            this.components.albumGrid.show();
            this.components.trackList.hide();
            this.components.albumGrid.setData(
                this.albums,
                this.albumKeys,
                this.metadata.albumCovers
            );
            EventBus.emit('view:changed', { view: 'ALBUMS' });

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

            this.components.albumGrid.hide();
            this.components.trackList.show();
            this.components.trackList.setTracks(this.viewList);
            EventBus.emit('view:changed', { view: 'TRACKS', title: albumName });

            // Auto-play first track
            if (autoPlay && this.viewList.length > 0) {
                setTimeout(() => this.playTrack(this.viewList[0].id), 100);
            }
        }
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

    /**
     * Show permission banner
     */
    showPermissionBanner() {
        if (this.permissionBanner) {
            this.permissionBanner.classList.remove('hidden');
        }
    }

    /**
     * Hide permission banner
     */
    hidePermissionBanner() {
        if (this.permissionBanner) {
            this.permissionBanner.classList.add('hidden');
        }
    }

    /**
     * Handle permission banner click - request permission
     */
    async handlePermissionRequest() {
        if (!this.fs.getDirectoryHandle()) {
            console.warn('[App] No directory handle available');
            return;
        }

        try {
            const granted = await this.fs.requestPermission();
            if (granted) {
                this.hidePermissionBanner();
                console.log('[App] Permission granted');
            }
        } catch (error) {
            console.error('[App] Error requesting permission:', error);
        }
    }
}

// Initialize app when DOM is ready
const app = new MusicPlayerApp();

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

// Logger utility
window.toggleLogs = () => {
    const panel = document.getElementById('log-panel');
    panel.classList.toggle('expanded');
};

// Expose app and utilities to console for debugging
window.app = app;
window.showTopStats = async () => {
    if (app.db) {
        return await app.db.logTopStats();
    } else {
        console.error('Database not initialized yet');
    }
};
