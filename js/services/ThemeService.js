/**
 * ThemeService - Handles theme management (dark/light)
 */
import EventBus from '../utils/EventBus.js';

class ThemeService {
    constructor() {
        this.currentTheme = 'dark';
        this.html = document.documentElement;
    }

    /**
     * Initialize theme service
     */
    init() {
        // Load saved theme or default to dark
        const savedTheme = localStorage.getItem('theme') || 'dark';
        this.applyTheme(savedTheme);
        console.log('[ThemeService] Initialized with theme:', savedTheme);
    }

    /**
     * Apply a theme
     * @param {string} theme - 'dark' or 'light'
     */
    applyTheme(theme) {
        this.currentTheme = theme;
        this.html.setAttribute('data-theme', theme);
        this.updateMetaTheme(theme);
        localStorage.setItem('theme', theme);

        // Emit theme change event
        EventBus.emit('theme:changed', theme);
    }

    /**
     * Toggle between dark and light themes
     */
    toggleTheme() {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme(newTheme);
    }

    /**
     * Get current theme
     * @returns {string} Current theme
     */
    getTheme() {
        return this.currentTheme;
    }

    /**
     * Update meta theme-color tag
     * @param {string} theme - Theme name
     */
    updateMetaTheme(theme) {
        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) {
            metaTheme.content = theme === 'dark' ? '#000000' : '#ffffff';
        }
    }
}

export default ThemeService;
