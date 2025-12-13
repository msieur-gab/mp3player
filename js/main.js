/**
 * Main Application Entry Point
 * Initializes services and manages application state
 */
import EventBus from './utils/EventBus.js';
import DatabaseService from './services/DatabaseService.js';
import PermissionManagerService from './services/PermissionManagerService.js';
import FileSystemService from './services/FileSystemService.js';
import MetadataService from './services/MetadataService.js';
import PlaybackService from './services/PlaybackService.js';
import ThemeService from './services/ThemeService.js';
import VisualizerService from './services/VisualizerService.js';
import DurationExtractionService from './services/DurationExtractionService.js';

// Import components
import './components/AppHeader.js';
import './components/PlayerControls.js';
import './components/AlbumGrid.js';
import './components/TrackList.js';
import './components/PermissionModal.js';
import './components/Toast.js';

class MusicPlayerApp {
    constructor() {
        // Initialize services
        this.db = new DatabaseService();
        this.permissions = new PermissionManagerService(this.db);
        this.metadata = new MetadataService(this.db);
        this.fs = new FileSystemService(this.db, this.metadata, this.permissions);
        this.playback = new PlaybackService(this.metadata, this.db);
        this.visualizer = new VisualizerService(this.playback);
        this.theme = new ThemeService();
        this.durationExtractor = new DurationExtractionService(this.db, this.metadata, this.permissions);

        // Application state
        this.allTracks = [];
        this.albums = {};
        this.albumKeys = [];
        this.currentView = 'ALBUMS';
        this.activeAlbumName = null;
        this.viewList = [];
        this.isFirstScan = false; // Track if this is initial scan or rescan

        // Components
        this.components = {};

        // Memory leak fix: Track event unsubscribers
        this.eventUnsubscribers = [];
        this.boundHandleResize = this.handleResize.bind(this);
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
            trackList: document.querySelector('track-list'),
            permissionModal: document.querySelector('permission-modal')
        };

        // Set services on TrackList
        this.components.trackList.setVisualizerService(this.visualizer);
        this.components.trackList.setDatabaseService(this.db);

        // Setup permission modal handler
        if (this.components.permissionModal) {
            this.components.permissionModal.addEventListener('grant-permission', () => {
                this.handlePermissionRequest();
            });
        }

        // Setup event listeners BEFORE services init (to catch init events)
        this.setupEventListeners();
        this.setupServiceWorker();

        // Initialize services
        await this.db.init();
        await this.permissions.init();
        await this.fs.init();
        this.playback.init();
        this.theme.init();

        // Load library
        await this.loadLibrary();

        console.log('[App] Ready');
    }

    /**
     * Setup all event listeners
     * Memory leak fix: Track all subscriptions for cleanup
     */
    setupEventListeners() {
        // Navigation events
        this.eventUnsubscribers.push(
            EventBus.on('navigation:back', () => this.switchView('ALBUMS')),
            EventBus.on('album:selected', (albumName) => this.switchView('TRACKS', albumName, false)),
            EventBus.on('track:selected', (trackId) => this.playTrack(trackId))
        );

        // Theme events
        this.eventUnsubscribers.push(
            EventBus.on('theme:toggle', () => this.theme.toggleTheme())
        );

        // Scan events
        this.eventUnsubscribers.push(
            EventBus.on('scan:request', () => this.handleScan())
        );

        // Playback events
        this.eventUnsubscribers.push(
            EventBus.on('playback:togglePlayPause', () => this.playback.togglePlayPause()),
            EventBus.on('playback:previous', () => this.playback.playPrev()),
            EventBus.on('playback:next', () => this.playback.playNext()),
            EventBus.on('playback:seek', (percent) => this.playback.seek(percent))
        );

        // Library events
        this.eventUnsubscribers.push(
            EventBus.on('scan:albumFound', async (albumData) => {
                // Progressive update only during first scan to avoid showing duplicates during rescan
                if (this.isFirstScan) {
                    // Update UI but don't start duration extraction during scan
                    await this.loadLibrary({ skipDurationExtraction: true });
                }
            }),
            EventBus.on('scan:completed', async () => {
                this.isFirstScan = false; // Reset after scan completes
                // Now start duration extraction after scan is complete
                await this.loadLibrary();
            })
        );

        // Permission events
        this.eventUnsubscribers.push(
            EventBus.on('permission:needed', () => {
                // Always show modal if permission lost (no throttling)
                // App is unusable without permissions
                this.showPermissionModal();
            })
        );

        // Duration extraction events
        this.eventUnsubscribers.push(
            EventBus.on('duration:trackExtracted', ({ trackId, duration }) => {
                // Update in-memory track
                const track = this.allTracks.find(t => t.id === trackId);
                if (!track) return;

                track.duration = duration;

                // Check if album is now complete (all tracks have duration)
                const albumName = track.album;
                const albumDuration = this.calculateAlbumDuration(albumName);

                // Only update UI if album is 100% complete
                if (albumDuration) {
                    if (this.currentView === 'ALBUMS') {
                        this.components.albumGrid.updateAlbumDuration(albumName, albumDuration);
                    } else if (this.currentView === 'TRACKS' && this.activeAlbumName === albumName) {
                        // Update album header
                        const tracks = this.albums[albumName];
                        const firstTrack = tracks[0];
                        const albumData = {
                            name: albumName,
                            artist: firstTrack.artist,
                            trackCount: tracks.length,
                            year: firstTrack.year || null,
                            genre: firstTrack.genre || null,
                            duration: albumDuration
                        };
                        this.components.trackList.albumData = albumData;
                        this.components.trackList.renderAlbumHeader();
                    }
                }
            })
        );

        // Memory leak fix: Use bound handler for window resize
        window.addEventListener('resize', this.boundHandleResize);
    }

    /**
     * Handle window resize
     */
    handleResize() {
        if (this.visualizer) {
            this.visualizer.handleResize();
        }
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
            // Check if this is first scan (empty library)
            this.isFirstScan = this.allTracks.length === 0;

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
     * @param {Object} options - Optional parameters
     * @param {boolean} options.skipDurationExtraction - Skip starting duration extraction (for progressive scan updates)
     */
    async loadLibrary(options = {}) {
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

                // Start background duration extraction for tracks missing duration
                // Skip during progressive scan updates to avoid repeatedly cancelling/restarting
                if (!options.skipDurationExtraction) {
                    const tracksNeedingDuration = this.allTracks.filter(t => !t.duration);
                    if (tracksNeedingDuration.length > 0) {
                        console.log(`[App] Extracting durations for ${tracksNeedingDuration.length} tracks`);
                        this.extractMissingDurations(tracksNeedingDuration);
                    }
                }
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
     * Start background duration extraction
     */
    async extractMissingDurations(tracks) {
        await this.durationExtractor.extractMissingDurations(tracks);
    }

    /**
     * Calculate total duration for an album
     * Returns null if ANY track is missing duration (accuracy requirement)
     */
    calculateAlbumDuration(albumName) {
        const tracks = this.albums[albumName];
        if (!tracks || tracks.length === 0) return null;

        // Require ALL tracks to have duration (no partial durations)
        const allHaveDuration = tracks.every(t => t.duration);
        if (!allHaveDuration) return null;

        return tracks.reduce((sum, t) => sum + t.duration, 0);
    }

    /**
     * Switch between views
     */
    async switchView(mode, albumName = null, autoPlay = false) {
        this.currentView = mode;

        if (mode === 'ALBUMS') {
            this.activeAlbumName = null;
            this.components.albumGrid.show();
            this.components.trackList.hide();

            // Calculate album durations (only complete albums)
            const albumDurations = {};
            this.albumKeys.forEach(name => {
                const duration = this.calculateAlbumDuration(name);
                if (duration) {
                    albumDurations[name] = duration;
                }
            });

            this.components.albumGrid.setData(
                this.albums,
                this.albumKeys,
                this.metadata.albumCovers,
                albumDurations
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

            // Prepare album data for header
            const firstTrack = this.viewList[0] || {};
            const albumData = {
                name: albumName,
                artist: firstTrack.artist || 'Unknown Artist',
                trackCount: this.viewList.length,
                year: firstTrack.year || null,
                genre: firstTrack.genre || null,
                duration: this.calculateAlbumDuration(albumName)
            };

            this.components.albumGrid.hide();
            this.components.trackList.show();
            await this.components.trackList.setTracks(this.viewList, albumData);
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
     * Show permission modal
     */
    showPermissionModal() {
        if (this.components.permissionModal) {
            this.components.permissionModal.show();
        }
    }

    /**
     * Hide permission modal
     */
    hidePermissionModal() {
        if (this.components.permissionModal) {
            this.components.permissionModal.hide();
        }
    }

    /**
     * Handle permission modal grant button click - request permission
     */
    async handlePermissionRequest() {
        const handle = await this.permissions.getHandle();
        if (!handle) {
            console.warn('[App] No directory handle available');
            this.hidePermissionModal();
            window.toast.error('No music folder configured. Please scan your music folder first.');
            return;
        }

        try {
            const granted = await this.permissions.requestPermissionManual();
            if (granted) {
                this.hidePermissionModal();
                window.toast.success('Folder access granted!');
                console.log('[App] Permission granted');
            } else {
                console.log('[App] Permission denied');
                window.toast.error('Permission denied. Tap "Grant Access" to try again.');
            }
        } catch (error) {
            console.error('[App] Error requesting permission:', error);
            window.toast.error('Failed to request permission. Please try again.');
        }
    }

    /**
     * Cleanup application resources
     * Memory leak fix: Unsubscribe from all events
     */
    destroy() {
        console.log('[App] 🗑️ Destroying application');

        // Cancel any ongoing extraction
        if (this.durationExtractor) {
            this.durationExtractor.cancel();
        }

        // Unsubscribe from EventBus
        this.eventUnsubscribers.forEach(unsub => unsub());
        this.eventUnsubscribers = [];

        // Remove window listener
        window.removeEventListener('resize', this.boundHandleResize);

        // Cleanup services
        if (this.visualizer) {
            this.visualizer.destroy();
        }

        console.log('[App] 🧹 Cleanup complete');
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
