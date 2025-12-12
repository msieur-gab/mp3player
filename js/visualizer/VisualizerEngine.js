/**
 * VisualizerEngine - Manages canvas rendering and animation loop
 *
 * Responsibilities:
 * - Canvas setup with device pixel ratio optimization
 * - Render loop with configurable FPS throttling
 * - Page visibility handling (battery saving)
 * - Pattern rendering coordination
 * - Performance monitoring
 *
 * Key Optimizations:
 * - OPTIMIZATION 2: Cap DPR to prevent excessive pixel rendering
 * - OPTIMIZATION 3: Page Visibility API - Stop rendering when tab hidden
 * - OPTIMIZATION 4: Adaptive quality for mobile devices
 * - FPS throttling for better battery life
 */
class VisualizerEngine {
    constructor(canvasElement, audioElement) {
        this.canvas = canvasElement;
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.audio = audioElement;

        // Canvas dimensions
        this.width = 0;
        this.height = 0;

        // Animation state
        this.enabled = false;
        this.time = 0;
        this.animationFrameId = null;

        // Adaptive FPS throttling
        this.targetFpsPlaying = 30;    // FPS when audio is playing
        this.targetFpsIdle = 1;         // FPS when paused (subtle idle animation)
        this.currentTargetFps = this.targetFpsIdle;  // Start at idle
        this.frameInterval = 1000 / this.currentTargetFps;
        this.lastFrameTime = 0;

        // Performance monitoring
        this.frameCount = 0;
        this.skippedFrames = 0;
        this.lastDebugLog = 0;

        // OPTIMIZATION 3: Page Visibility API
        this.isPageVisible = !document.hidden;
        this.setupVisibilityHandler();

        // OPTIMIZATION 4: Adaptive Quality
        this.isMobile = window.innerWidth < 600;
        this.qualityMultiplier = this.isMobile ? 0.85 : 1.0;

        console.log('[VisualizerEngine] 🎬 Initialized', {
            fpsPlaying: this.targetFpsPlaying,
            fpsIdle: this.targetFpsIdle,
            isMobile: this.isMobile,
            qualityMultiplier: this.qualityMultiplier
        });
    }

    /**
     * OPTIMIZATION 3: Setup page visibility handler
     */
    setupVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            this.isPageVisible = !document.hidden;
            console.log(`[VisualizerEngine] 👁️ Visibility: ${this.isPageVisible ? 'VISIBLE' : 'HIDDEN'}`);

            if (this.isPageVisible && this.enabled) {
                console.log('[VisualizerEngine] ▶️ Resuming (tab visible)');
                this.startRenderLoop();
            } else if (!this.isPageVisible && this.animationFrameId) {
                console.log('[VisualizerEngine] ⏸️ Pausing (tab hidden)');
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
        });
    }

    /**
     * Initialize canvas
     */
    init() {
        if (!this.canvas) {
            console.error('[VisualizerEngine] ❌ No canvas element');
            return false;
        }

        this.ctx = this.canvas.getContext('2d');
        this.setupCanvas();
        return true;
    }

    /**
     * Setup canvas with device pixel ratio
     * OPTIMIZATION 2: Cap DPR to prevent excessive pixel rendering
     */
    setupCanvas() {
        if (!this.canvas) return;

        // Cap DPR at 1.5 (reduces pixels by 75% on high-DPI devices)
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        this.width = rect.width;
        this.height = rect.height;

        console.log('[VisualizerEngine] 📐 Canvas setup', {
            width: this.width,
            height: this.height,
            dpr
        });
    }

    /**
     * Enable rendering
     */
    enable() {
        if (this.enabled) {
            console.log('[VisualizerEngine] ⚠️ Already enabled');
            return;
        }

        this.enabled = true;
        this.time = 0;
        this.lastFrameTime = performance.now();
        console.log('[VisualizerEngine] 🎨 Enabled');
    }

    /**
     * Disable rendering
     * Note: Does NOT clear canvas - call clearCanvas() separately if needed
     */
    disable() {
        if (!this.enabled) {
            console.log('[VisualizerEngine] ⚠️ Already disabled');
            return;
        }

        this.enabled = false;

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        console.log('[VisualizerEngine] 🛑 Disabled (keeping last frame)');
    }

    /**
     * Start render loop
     */
    startRenderLoop() {
        if (!this.enabled || this.animationFrameId) return;
        this.animationFrameId = requestAnimationFrame((t) => this.renderLoop(t));
    }

    /**
     * Main render loop with FPS throttling
     * OPTIMIZATION 3: Respects page visibility
     *
     * @param {function} renderCallback - Function called to render frame (ctx, width, height, frame)
     */
    renderLoop(currentTime, renderCallback) {
        if (!this.enabled) return;

        // OPTIMIZATION 3: Stop if page hidden
        if (!this.isPageVisible) {
            console.log('[VisualizerEngine] ⏭️ Skipping (page hidden)');
            return;
        }

        // Request next frame
        this.animationFrameId = requestAnimationFrame((t) =>
            this.renderLoop(t, renderCallback)
        );

        // FPS throttling
        if (!currentTime) currentTime = performance.now();

        // ADAPTIVE FPS: Adjust frame rate based on playing state
        const isPlaying = this.audio && !this.audio.paused;
        const targetFps = isPlaying ? this.targetFpsPlaying : this.targetFpsIdle;

        // Update frame interval if target changed
        if (targetFps !== this.currentTargetFps) {
            this.currentTargetFps = targetFps;
            this.frameInterval = 1000 / targetFps;
            console.log(`[VisualizerEngine] 🎯 Adaptive FPS: ${isPlaying ? 'PLAYING' : 'IDLE'} → ${targetFps} FPS`);
        }

        const elapsed = currentTime - this.lastFrameTime;

        if (elapsed < this.frameInterval) {
            this.skippedFrames++;
            return; // Skip this frame
        }

        // Adjust for latency drift
        this.lastFrameTime = currentTime - (elapsed % this.frameInterval);

        // Update time only if playing
        if (isPlaying) {
            this.time += this.frameInterval / 1000;
        }

        this.frameCount++;

        // Reset counters every 3 seconds
        if (currentTime - this.lastDebugLog > 3000) {
            this.frameCount = 0;
            this.skippedFrames = 0;
            this.lastDebugLog = currentTime;
        }

        // Call render callback if provided
        if (renderCallback && typeof renderCallback === 'function') {
            renderCallback(isPlaying);
        }
    }

    /**
     * Get frame metadata
     */
    getFrameMetadata() {
        return {
            time: this.time,
            qualityMultiplier: this.qualityMultiplier,
            isPlaying: this.audio && !this.audio.paused
        };
    }

    /**
     * Clear canvas with fade effect
     */
    clearWithFade(fadeAmount = 0.2) {
        if (!this.ctx) return;
        this.ctx.fillStyle = `rgba(0, 0, 0, ${fadeAmount})`;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    /**
     * Clear canvas completely
     */
    clearCanvas() {
        if (!this.ctx) return;
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    /**
     * Handle window resize
     */
    handleResize() {
        this.setupCanvas();
        this.isMobile = window.innerWidth < 600;
        this.qualityMultiplier = this.isMobile ? 0.85 : 1.0;
    }

    /**
     * Update canvas element
     */
    setCanvas(canvasElement) {
        this.canvas = canvasElement;
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        if (this.canvas) {
            this.setupCanvas();
        }
    }

    /**
     * Update audio element reference
     */
    setAudioElement(audioElement) {
        this.audio = audioElement;
    }

    /**
     * Set target FPS for playing and idle states
     */
    setTargetFps(fpsPlaying, fpsIdle = 1) {
        this.targetFpsPlaying = fpsPlaying;
        this.targetFpsIdle = fpsIdle;
        console.log(`[VisualizerEngine] 🎯 Target FPS set: ${fpsPlaying} (playing) / ${fpsIdle} (idle)`);
    }

    /**
     * Destroy visualizer engine and cleanup resources
     */
    destroy() {
        console.log('[VisualizerEngine] 🗑️ Destroying visualizer engine');

        // Stop animation loop
        this.disable();

        // Clear canvas
        this.clearCanvas();

        // Nullify references
        this.canvas = null;
        this.ctx = null;
    }
}

export default VisualizerEngine;
