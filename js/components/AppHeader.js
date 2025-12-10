/**
 * AppHeader - Custom element for the application header
 */
import EventBus from '../utils/EventBus.js';

class AppHeader extends HTMLElement {
    constructor() {
        super();
        this.currentView = 'ALBUMS';
        this.trackCount = 0;
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
    }

    render() {
        this.innerHTML = `
            <header class="header">
                <div class="header-left">
                    <!-- Back Button (Hidden by default) -->
                    <button id="backBtn" class="btn-icon hidden">
                        <i class="ph ph-arrow-left" style="color: #c4b5fd; font-weight: 700; font-size: 1.125rem;"></i>
                    </button>

                    <!-- Branding -->
                    <div class="branding" id="header-branding">
                        <div class="logo">
                            <i class="ph ph-music-notes"></i>
                        </div>
                        <div class="branding-text">
                            <h1>Local Stream</h1>
                            <p id="status">Ready</p>
                        </div>
                    </div>

                    <!-- Album Title (Hidden by default) -->
                    <h1 id="header-title" class="header-title hidden">Album View</h1>
                </div>

                <div class="header-right">
                    <button id="themeBtn" class="btn-icon" title="Toggle theme">
                        <i id="themeIcon" class="ph ph-moon"></i>
                    </button>
                    <button id="installBtn" class="btn btn-secondary hidden">
                        <i class="ph ph-download-simple"></i>
                    </button>
                    <button id="scanBtn" class="btn btn-primary">
                        <i class="ph ph-folder-notch-open"></i> Scan
                    </button>
                </div>
            </header>
        `;
    }

    setupEventListeners() {
        // Back button
        this.querySelector('#backBtn').addEventListener('click', () => {
            EventBus.emit('navigation:back');
        });

        // Theme button
        this.querySelector('#themeBtn').addEventListener('click', () => {
            EventBus.emit('theme:toggle');
        });

        // Scan button
        this.querySelector('#scanBtn').addEventListener('click', () => {
            EventBus.emit('scan:request');
        });

        // Listen to events
        EventBus.on('view:changed', ({ view, title }) => {
            this.updateView(view, title);
        });

        EventBus.on('theme:changed', (theme) => {
            this.updateThemeIcon(theme);
        });

        EventBus.on('library:loaded', (count) => {
            this.updateStatus(`${count} tracks`);
        });

        EventBus.on('scan:started', () => {
            this.setScanningState(true);
        });

        EventBus.on('scan:completed', () => {
            this.setScanningState(false);
        });
    }

    updateView(view, title = null) {
        this.currentView = view;
        const backBtn = this.querySelector('#backBtn');
        const branding = this.querySelector('#header-branding');
        const titleEl = this.querySelector('#header-title');

        if (view === 'ALBUMS') {
            backBtn.classList.add('hidden');
            branding.classList.remove('hidden');
            titleEl.classList.add('hidden');
        } else if (view === 'TRACKS') {
            backBtn.classList.remove('hidden');
            branding.classList.add('hidden');
            titleEl.innerText = title || 'Tracks';
            titleEl.classList.remove('hidden');
        }
    }

    updateThemeIcon(theme) {
        const icon = this.querySelector('#themeIcon');
        icon.className = theme === 'dark' ? 'ph ph-moon' : 'ph ph-sun';
    }

    updateStatus(text) {
        const status = this.querySelector('#status');
        if (status) status.innerText = text;
    }

    setScanningState(scanning) {
        const btn = this.querySelector('#scanBtn');
        btn.disabled = scanning;
        btn.innerHTML = scanning
            ? '<i class="ph ph-folder-notch-open"></i> Scanning...'
            : '<i class="ph ph-folder-notch-open"></i> Scan';
    }

    showInstallButton() {
        this.querySelector('#installBtn').classList.remove('hidden');
    }

    hideInstallButton() {
        this.querySelector('#installBtn').classList.add('hidden');
    }

    getInstallButton() {
        return this.querySelector('#installBtn');
    }
}

customElements.define('app-header', AppHeader);
export default AppHeader;
