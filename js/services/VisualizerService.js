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

        // OPTIMIZATION 1: Zero-Allocation - Pre-allocate audio data arrays
        // These are reused every frame instead of creating new ones (prevents GC pauses)
        this.rawDataArray = null;      // Uint8Array - reused
        this.spectrumArray = null;     // Float32Array - reused
        this.binCount = 256;           // Default, updated when analyser is ready

        // Animation state
        this.enabled = false;
        this.activePattern = 'needles';
        this.time = 0;
        this.animationFrameId = null;

        // Frame rate control (configurable FPS throttling)
        this.targetFps = 30; // Lower FPS = better battery life
        this.frameInterval = 1000 / this.targetFps;
        this.lastFrameTime = 0;

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

        // OPTIMIZATION 4: Adaptive Quality - Detect mobile device
        this.isMobile = window.innerWidth < 600;
        this.qualityMultiplier = this.isMobile ? 0.5 : 1.0; // 50% reduction on mobile

        // OPTIMIZATION 3: Page Visibility API - Stop rendering when tab hidden
        this.isPageVisible = !document.hidden;
        this.setupVisibilityHandler();
    }

    /**
     * OPTIMIZATION 3: Setup page visibility handler to pause when tab hidden
     */
    setupVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            this.isPageVisible = !document.hidden;

            if (this.isPageVisible && this.enabled) {
                // Resume animation when tab becomes visible
                this.render();
            } else if (!this.isPageVisible && this.animationFrameId) {
                // Stop animation when tab hidden (prevents battery drain)
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
        });
    }

    /**
     * Initialize with canvas element
     */
    init(canvasElement) {
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d');
        this.setupCanvas();
        this.setupAudioAnalyser();
    }

    /**
     * Setup canvas with device pixel ratio
     * OPTIMIZATION 2: Cap DPR to prevent excessive pixel rendering on high-DPI screens
     */
    setupCanvas() {
        if (!this.canvas) return;

        // Cap DPR at 1.5 to prevent 9x-16x pixel rendering on high-end phones
        // iPhone 14 Pro has DPR 3.0, this reduces pixels by 75% with no visual loss
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        this.width = rect.width;
        this.height = rect.height;
    }

    /**
     * Setup audio analyser node connected to playback
     * OPTIMIZATION 1: Allocate audio data arrays once here
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
            }

            // Create analyser node
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 512;
            this.analyser.smoothingTimeConstant = 0.8;

            // OPTIMIZATION 1: Pre-allocate arrays ONCE (not every frame)
            // This prevents garbage collection pauses that caused audio glitches
            this.binCount = this.analyser.frequencyBinCount;
            this.rawDataArray = new Uint8Array(this.binCount);
            this.spectrumArray = new Float32Array(this.binCount);

            // Create media element source if not already created
            if (!this.mediaSource) {
                this.mediaSource = this.audioContext.createMediaElementSource(this.playback.audio);
            }

            // Connect: audio -> analyser -> destination
            this.mediaSource.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);
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
        this.lastFrameTime = performance.now(); // Reset timer

        // Ensure audio analyser is connected
        if (!this.analyser) {
            this.setupAudioAnalyser();
        }

        this.render();
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
     * Get audio frame data for rendering
     * OPTIMIZATION 1: ZERO ALLOCATION - Reuse pre-allocated arrays
     */
    getFrameData() {
        // If arrays aren't allocated yet, use fallback (shouldn't happen after init)
        if (!this.rawDataArray || !this.spectrumArray) {
            this.binCount = this.analyser ? this.analyser.frequencyBinCount : 128;
            this.rawDataArray = new Uint8Array(this.binCount);
            this.spectrumArray = new Float32Array(this.binCount);
        }

        if (this.analyser) {
            // CRITICAL: Reuse existing array, don't create new one
            this.analyser.getByteFrequencyData(this.rawDataArray);

            // CRITICAL: Overwrite values in pre-allocated array
            for (let i = 0; i < this.binCount; i++) {
                this.spectrumArray[i] = this.rawDataArray[i] / 255;
            }
        }

        // Calculate frequency bands (using cached spectrum array)
        const getAvg = (start, end) => {
            let sum = 0;
            for (let i = start; i < end; i++) sum += this.spectrumArray[i] || 0;
            return sum / (end - start || 1);
        };

        const bass = getAvg(0, 8);
        const mid = getAvg(8, 64);
        const high = getAvg(64, 128);
        const overall = getAvg(0, this.binCount);

        // Beat detection
        if (bass > this.beatThreshold && this.currentPulse < 0.2) {
            this.currentPulse = 1.0;
        } else {
            this.currentPulse *= this.beatDecay;
        }

        return {
            spectrum: this.spectrumArray,  // Return cached array (not a new one)
            energy: { bass, mid, high, overall },
            beatPulse: this.currentPulse,
            time: this.time,
            isPlaying: this.playback.audio && !this.playback.audio.paused,
            qualityMultiplier: this.qualityMultiplier  // OPTIMIZATION 4: Pass quality setting
        };
    }

    /**
     * Main render loop with configurable FPS throttling
     * OPTIMIZATION 3: Respects page visibility to prevent battery drain
     */
    render(currentTime) {
        if (!this.enabled) return;

        // OPTIMIZATION 3: Don't schedule next frame if page is hidden
        if (!this.isPageVisible) {
            return;
        }

        // Request next frame immediately to keep loop alive
        this.animationFrameId = requestAnimationFrame((t) => this.render(t));

        // FPS throttling: Calculate time elapsed since last frame
        if (!currentTime) currentTime = performance.now();
        const elapsed = currentTime - this.lastFrameTime;

        // Only render if enough time has passed (e.g., 33.3ms for 30fps)
        if (elapsed < this.frameInterval) {
            return; // Skip this frame
        }

        // Adjust for latency drift
        this.lastFrameTime = currentTime - (elapsed % this.frameInterval);

        // Update time only if playing
        const isPlaying = this.playback.audio && !this.playback.audio.paused;
        if (isPlaying) {
            this.time += this.frameInterval / 1000; // Time increment based on target FPS
        }

        // Get audio data (zero-allocation)
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
