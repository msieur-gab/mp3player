/**
 * VisualizerService - Refactored with Engine/Art separation
 *
 * This service coordinates between:
 * - AudioEngine: Audio analysis and frequency data
 * - VisualizerEngine: Canvas rendering and animation loop
 * - Patterns: Visual effects (completely stateless)
 * - Noise: Perlin noise generator for organic motion
 *
 * Key Benefits of this architecture:
 * - Clean separation of concerns (audio, canvas, visuals)
 * - Easy to add/remove/customize patterns
 * - Patterns are completely stateless and portable
 * - Engines can be reused in other contexts
 * - Better testability and maintainability
 */
import EventBus from '../utils/EventBus.js';
import AudioEngine from '../visualizer/AudioEngine.js';
import VisualizerEngine from '../visualizer/VisualizerEngine.js';
import Noise from '../visualizer/utils.js';
import { PATTERNS, getPatternNames } from '../visualizer/patterns/index.js';

class VisualizerService {
    constructor(playbackService) {
        this.playback = playbackService;

        // Engines
        this.audioEngine = null;
        this.visualizerEngine = null;
        this.noise = new Noise();

        // State
        this.activePattern = 'needles';
        this.patterns = PATTERNS;

        // Lifecycle state
        this.initialized = false;
        this.eventUnsubscribers = [];

        console.log('[VisualizerService] 🎬 Initialized', {
            availablePatterns: getPatternNames()
        });
    }

    /**
     * Initialize with canvas element
     */
    init(canvasElement) {
        // Clean up old engines if they exist
        if (this.visualizerEngine) {
            this.visualizerEngine.disable();
        }

        // Initialize engines (reuse AudioEngine, recreate VisualizerEngine)
        if (!this.audioEngine) {
            this.audioEngine = new AudioEngine(this.playback.audio);
            this.audioEngine.init();
        }

        this.visualizerEngine = new VisualizerEngine(canvasElement, this.playback.audio);
        this.visualizerEngine.init();

        // Setup playback listeners only once
        if (!this.initialized) {
            this.setupPlaybackListeners();
            this.initialized = true;
        }

        console.log('[VisualizerService] ✅ Initialization complete');
    }

    /**
     * Setup playback event listeners
     */
    setupPlaybackListeners() {
        // Store unsubscribe functions to prevent accumulation
        const unsubPlay = EventBus.on('playback:play', () => {
            console.log('[VisualizerService] ▶️ Play event received');
            this.enable();
        });

        const unsubPause = EventBus.on('playback:pause', () => {
            console.log('[VisualizerService] ⏸️ Pause event received');
            // Don't disable - let adaptive FPS handle it (switches to 1 FPS automatically)
            // This allows pattern switching to work when paused
        });

        this.eventUnsubscribers.push(unsubPlay, unsubPause);
        console.log('[VisualizerService] 📡 Event listeners registered (one-time)');
    }

    /**
     * Enable visualizer
     */
    enable() {
        if (!this.visualizerEngine || !this.audioEngine) {
            console.warn('[VisualizerService] ⚠️ Engines not initialized');
            return;
        }

        // Ensure audio engine is connected
        if (!this.audioEngine.analyser) {
            this.audioEngine.init();
        }

        // Enable visualizer engine
        this.visualizerEngine.enable();

        // Start render loop
        this.render();

        console.log('[VisualizerService] 🎨 Enabled', {
            pattern: this.activePattern
        });
    }

    /**
     * Disable visualizer
     * Freezes last frame on canvas (0 FPS, zero resources, 1 line)
     */
    disable() {
        if (this.visualizerEngine) {
            this.visualizerEngine.disable();
            console.log('[VisualizerService] 🛑 Disabled (freeze frame, 0 FPS)');
        }
    }

    /**
     * Main render loop
     * Coordinates between engines and patterns
     */
    render() {
        if (!this.visualizerEngine.enabled) return;

        // Use the visualizer engine's render loop
        this.visualizerEngine.renderLoop(
            performance.now(),
            (isPlaying) => this.renderFrame(isPlaying)
        );
    }

    /**
     * Render a single frame
     * This is where Engine meets Art
     */
    renderFrame(isPlaying) {
        // Get audio data from AudioEngine
        const audioData = this.audioEngine.getFrameData();

        // Get frame metadata from VisualizerEngine
        const frameMetadata = this.visualizerEngine.getFrameMetadata();

        // Combine into complete frame data for patterns
        const frame = {
            ...audioData,
            ...frameMetadata,
            isPlaying
        };

        // Clear canvas with fade effect
        this.visualizerEngine.clearWithFade(0.2);

        // Render active pattern
        const pattern = this.patterns[this.activePattern];
        if (pattern && pattern.draw) {
            pattern.draw(
                this.visualizerEngine.ctx,
                this.visualizerEngine.width,
                this.visualizerEngine.height,
                frame,
                this.noise
            );
        }

        // Continue render loop
        this.render();
    }

    /**
     * Set active pattern
     */
    setPattern(patternName) {
        if (this.patterns[patternName]) {
            this.activePattern = patternName;

            // Clear canvas to prevent overlap when switching at 1 FPS (idle/paused)
            if (this.visualizerEngine) {
                this.visualizerEngine.clearCanvas();
            }

            // Render immediately for instant visual feedback (don't wait for next frame at 1 FPS)
            if (this.visualizerEngine && this.visualizerEngine.enabled) {
                const isPlaying = this.playback.audio && !this.playback.audio.paused;
                this.renderFrame(isPlaying);
            }

            console.log(`[VisualizerService] 🎭 Pattern changed to: ${patternName}`);
        } else {
            console.warn(`[VisualizerService] ⚠️ Pattern not found: ${patternName}`);
        }
    }

    /**
     * Get available pattern names
     */
    getPatternNames() {
        return Object.keys(this.patterns);
    }

    /**
     * Get pattern metadata
     */
    getPatternMetadata(patternName) {
        return this.patterns[patternName] || null;
    }

    /**
     * Handle window resize
     */
    handleResize() {
        if (this.visualizerEngine) {
            this.visualizerEngine.handleResize();
        }
    }

    /**
     * Setup audio analyser (called when audio element changes)
     */
    setupAudioAnalyser() {
        if (this.audioEngine) {
            this.audioEngine.setAudioElement(this.playback.audio);
            this.audioEngine.init();
        }

        if (this.visualizerEngine) {
            this.visualizerEngine.setAudioElement(this.playback.audio);
        }

        console.log('[VisualizerService] 🔊 Audio analyser setup complete');
    }

    /**
     * Destroy visualizer service and cleanup resources
     */
    destroy() {
        console.log('[VisualizerService] 🗑️ Destroying visualizer service');

        // Unsubscribe from all events
        this.eventUnsubscribers.forEach(unsub => unsub());
        this.eventUnsubscribers = [];

        // Destroy engines
        if (this.audioEngine) {
            this.audioEngine.destroy();
            this.audioEngine = null;
        }

        if (this.visualizerEngine) {
            this.visualizerEngine.disable();
            this.visualizerEngine.clearCanvas();
            this.visualizerEngine = null;
        }

        this.initialized = false;
    }
}

export default VisualizerService;
