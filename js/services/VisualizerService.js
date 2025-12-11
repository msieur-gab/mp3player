/**
 * VisualizerService - Audio visualization with 30fps patterns
 * Integrates with PlaybackService for audio analysis
 */
import EventBus from '../utils/EventBus.js';
import Noise from '../visualizer/utils.js';
import { drawNeedles, drawBreath, drawHorizon, drawGrid, drawMosaic } from '../visualizer/patterns.js';

class VisualizerService {
    constructor(playbackService) {
        this.playback = playbackService;
        this.noise = new Noise();

        // Canvas state
        this.canvas = null;
        this.ctx = null;
        this.width = 0;
        this.height = 0;

        // Audio analysis
        this.audioContext = null;
        this.mediaSource = null;
        this.analyser = null;

        // Animation state
        this.enabled = false;
        this.activePattern = 'needles';
        this.time = 0;
        this.frameCount = 0;
        this.animationFrameId = null;

        // Pattern registry
        this.patterns = {
            needles: drawNeedles,
            breath: drawBreath,
            horizon: drawHorizon,
            grid: drawGrid,
            mosaic: drawMosaic
        };

        // Beat detection
        this.beatThreshold = 0.55;
        this.beatDecay = 0.95;
        this.currentPulse = 0;

        console.log('[VisualizerService] Initialized');
    }

    /**
     * Initialize with canvas element
     */
    init(canvasElement) {
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d');
        this.setupCanvas();
        this.setupAudioAnalyser();
        console.log('[VisualizerService] Ready');
    }

    /**
     * Setup canvas with device pixel ratio
     */
    setupCanvas() {
        if (!this.canvas) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        this.width = rect.width;
        this.height = rect.height;
    }

    /**
     * Setup audio analyser node connected to playback
     */
    setupAudioAnalyser() {
        // Wait for PlaybackService audio element
        if (!this.playback.audio) {
            console.warn('[VisualizerService] Audio element not ready');
            return;
        }

        try {
            // Create audio context if needed
            if (!this.audioContext) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                this.audioContext = new AudioContext();
                console.log('[VisualizerService] Created AudioContext');
            }

            // Create analyser node
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 512;
            this.analyser.smoothingTimeConstant = 0.8;

            // Create media element source if not already created
            if (!this.mediaSource) {
                this.mediaSource = this.audioContext.createMediaElementSource(this.playback.audio);
                console.log('[VisualizerService] Created MediaElementSource');
            }

            // Connect: audio -> analyser -> destination
            this.mediaSource.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);

            console.log('[VisualizerService] Audio analyser connected');
        } catch (error) {
            console.error('[VisualizerService] Error setting up analyser:', error);
        }
    }

    /**
     * Enable visualizer and start rendering
     */
    enable() {
        if (this.enabled) return;
        this.enabled = true;
        this.time = 0;
        this.frameCount = 0;

        // Ensure audio analyser is connected
        if (!this.analyser) {
            this.setupAudioAnalyser();
        }

        this.render();
        EventBus.emit('visualizer:enabled');
        console.log('[VisualizerService] Enabled');
    }

    /**
     * Disable visualizer and stop rendering
     */
    disable() {
        if (!this.enabled) return;
        this.enabled = false;

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // Clear canvas
        if (this.ctx) {
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(0, 0, this.width, this.height);
        }

        EventBus.emit('visualizer:disabled');
        console.log('[VisualizerService] Disabled');
    }

    /**
     * Toggle visualizer on/off
     */
    toggle() {
        if (this.enabled) {
            this.disable();
        } else {
            this.enable();
        }
    }

    /**
     * Set active pattern
     */
    setPattern(patternName) {
        if (this.patterns[patternName]) {
            this.activePattern = patternName;
            EventBus.emit('visualizer:patternChanged', patternName);
            console.log(`[VisualizerService] Pattern: ${patternName}`);
        }
    }

    /**
     * Get audio frame data for rendering
     */
    getFrameData() {
        const binCount = this.analyser ? this.analyser.frequencyBinCount : 128;
        const rawData = new Uint8Array(binCount);
        const spectrum = new Float32Array(binCount);

        if (this.analyser) {
            this.analyser.getByteFrequencyData(rawData);
            for (let i = 0; i < binCount; i++) {
                spectrum[i] = rawData[i] / 255;
            }
        }

        // Calculate frequency bands
        const getAvg = (start, end) => {
            let sum = 0;
            for (let i = start; i < end; i++) sum += spectrum[i] || 0;
            return sum / (end - start || 1);
        };

        const bass = getAvg(0, 8);
        const mid = getAvg(8, 64);
        const high = getAvg(64, 128);
        const overall = getAvg(0, binCount);

        // Beat detection
        if (bass > this.beatThreshold && this.currentPulse < 0.2) {
            this.currentPulse = 1.0;
        } else {
            this.currentPulse *= this.beatDecay;
        }

        return {
            spectrum,
            energy: { bass, mid, high, overall },
            beatPulse: this.currentPulse,
            time: this.time,
            isPlaying: this.playback.audio && !this.playback.audio.paused
        };
    }

    /**
     * Main render loop (30fps)
     */
    render() {
        if (!this.enabled) return;

        this.animationFrameId = requestAnimationFrame(() => this.render());

        // 30fps throttle: Skip every other frame
        this.frameCount++;
        if (this.frameCount % 2 !== 0) {
            return;
        }

        // Update time only if playing
        const isPlaying = this.playback.audio && !this.playback.audio.paused;
        if (isPlaying) {
            this.time += 0.032; // Double increment for 30fps
        }

        // Get audio data
        const frame = this.getFrameData();

        // Clear canvas with fade
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Draw active pattern
        const drawFn = this.patterns[this.activePattern];
        if (drawFn) {
            drawFn(this.ctx, this.width, this.height, frame, this.noise);
        }
    }

    /**
     * Handle window resize
     */
    handleResize() {
        this.setupCanvas();
    }
}

export default VisualizerService;
