/**
 * VisualizerServiceSimple - Simplified audio visualizer
 *
 * Key simplifications:
 * - No manual FPS throttling (browser handles it)
 * - No pre-allocated arrays (browser optimizes this)
 * - No beat detection (patterns respond to raw audio)
 * - No quality multipliers (one size fits all)
 * - Complete frame rendering (no fade effects)
 * - Minimal state tracking
 */
import EventBus from '../utils/EventBus.js';
import Noise from '../visualizer/utils.js';
import { drawNeedles, drawBreath, drawHorizon, drawGrid } from '../visualizer/patterns-simple.js';

class VisualizerServiceSimple {
    constructor(playbackService) {
        this.playback = playbackService;
        this.noise = new Noise();

        // Canvas
        this.canvas = null;
        this.ctx = null;
        this.width = 0;
        this.height = 0;

        // Audio analysis
        this.audioContext = null;
        this.mediaSource = null;
        this.analyser = null;

        // State
        this.playing = false;
        this.activePattern = 'needles';
        this.time = 0;

        // Available patterns
        this.patterns = {
            needles: drawNeedles,
            breath: drawBreath,
            horizon: drawHorizon,
            grid: drawGrid
        };
    }

    /**
     * Initialize with canvas element
     */
    init(canvasElement) {
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d');
        this.setupCanvas();
        this.setupAudio();
        this.setupPlaybackListeners();
    }

    /**
     * Setup canvas size
     */
    setupCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.width = rect.width;
        this.height = rect.height;
    }

    /**
     * Setup audio analysis
     */
    setupAudio() {
        if (!this.playback.audio) return;

        try {
            // Create audio context
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();

            // Create analyser
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.8;

            // Connect audio element
            if (!this.mediaSource) {
                this.mediaSource = this.audioContext.createMediaElementSource(this.playback.audio);
            }

            this.mediaSource.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);
        } catch (error) {
            console.error('[VisualizerSimple] Audio setup error:', error);
        }
    }

    /**
     * Setup playback event listeners
     */
    setupPlaybackListeners() {
        // Start rendering when audio plays
        EventBus.on('playback:play', () => {
            this.playing = true;
            this.render();
        });

        // Stop rendering when audio pauses
        EventBus.on('playback:pause', () => {
            this.playing = false;
        });
    }

    /**
     * Get audio spectrum data
     */
    getSpectrum() {
        if (!this.analyser) return null;

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);

        // Convert to normalized values (0-1)
        const spectrum = [];
        for (let i = 0; i < dataArray.length; i++) {
            spectrum[i] = dataArray[i] / 255;
        }

        // Calculate frequency bands
        const bass = this.getAverage(spectrum, 0, 8);
        const mid = this.getAverage(spectrum, 8, 64);
        const high = this.getAverage(spectrum, 64, 128);

        return {
            spectrum,
            bass,
            mid,
            high,
            time: this.time
        };
    }

    /**
     * Get average of array slice
     */
    getAverage(array, start, end) {
        let sum = 0;
        for (let i = start; i < end && i < array.length; i++) {
            sum += array[i];
        }
        return sum / (end - start);
    }

    /**
     * Main render loop
     */
    render() {
        if (!this.playing) return;

        // Schedule next frame
        requestAnimationFrame(() => this.render());

        // Increment time
        this.time += 0.016; // Roughly 60fps

        // Get audio data
        const audioData = this.getSpectrum();
        if (!audioData) return;

        // Clear canvas (complete frame rendering)
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Draw pattern
        const drawFn = this.patterns[this.activePattern];
        if (drawFn) {
            drawFn(this.ctx, this.width, this.height, audioData, this.noise);
        }
    }

    /**
     * Enable visualizer
     */
    enable() {
        this.playing = true;
        this.time = 0;
        this.render();
    }

    /**
     * Disable visualizer
     */
    disable() {
        this.playing = false;

        // Clear canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    /**
     * Set active pattern
     */
    setPattern(patternName) {
        if (this.patterns[patternName]) {
            this.activePattern = patternName;
        }
    }

    /**
     * Handle window resize
     */
    handleResize() {
        this.setupCanvas();
    }
}

export default VisualizerServiceSimple;
