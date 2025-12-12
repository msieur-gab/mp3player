/**
 * AudioEngine - Handles audio analysis for visualization
 *
 * Responsibilities:
 * - Audio context and analyser node management
 * - Zero-allocation audio data buffering
 * - Frequency spectrum analysis
 * - Beat detection
 * - Connection management (prevents audio overlap bugs)
 *
 * Key Optimizations:
 * - OPTIMIZATION 1: Zero-Allocation - Pre-allocated buffers prevent GC pauses
 * - Clean disconnect/reconnect logic prevents audio overlap
 * - Configurable FFT size and smoothing
 */
class AudioEngine {
    constructor(audioElement) {
        this.audio = audioElement;
        this.audioContext = null;
        this.mediaSource = null;
        this.analyser = null;

        // OPTIMIZATION 1: Zero-Allocation - Pre-allocated arrays
        this.rawDataArray = null;
        this.spectrumArray = null;
        this.binCount = 256;

        // Beat detection
        this.beatThreshold = 0.55;
        this.beatDecay = 0.95;
        this.currentPulse = 0;

        // Configuration
        this.fftSize = 512;
        this.smoothingTimeConstant = 0.8;
    }

    /**
     * Initialize audio engine
     */
    init() {
        if (!this.audio) {
            console.warn('[AudioEngine] ⚠️ Audio element not ready');
            return false;
        }

        console.log('[AudioEngine] 🔊 Initializing audio engine');

        try {
            // Create audio context if needed
            if (!this.audioContext) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                this.audioContext = new AudioContext();
                console.log('[AudioEngine] 🎵 Created AudioContext');
            }

            // Disconnect old analyser before creating new one
            if (this.analyser) {
                try {
                    this.analyser.disconnect();
                    console.log('[AudioEngine] 🔌 Disconnected old analyser');
                } catch (e) {
                    console.log('[AudioEngine] ℹ️ Old analyser already disconnected');
                }
            }

            // Create analyser node
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.fftSize;
            this.analyser.smoothingTimeConstant = this.smoothingTimeConstant;
            console.log(`[AudioEngine] 📊 Created analyser (fftSize: ${this.fftSize})`);

            // OPTIMIZATION 1: Pre-allocate arrays ONCE
            this.binCount = this.analyser.frequencyBinCount;
            this.rawDataArray = new Uint8Array(this.binCount);
            this.spectrumArray = new Float32Array(this.binCount);
            console.log(`[AudioEngine] 💾 Pre-allocated buffers (${this.binCount} bins)`);

            // Create media element source if not already created
            if (!this.mediaSource) {
                this.mediaSource = this.audioContext.createMediaElementSource(this.audio);
                console.log('[AudioEngine] 🔗 Created MediaElementSource');
            } else {
                // Disconnect from old analyser before reconnecting
                try {
                    this.mediaSource.disconnect();
                    console.log('[AudioEngine] 🔌 Disconnected mediaSource');
                } catch (e) {
                    console.log('[AudioEngine] ℹ️ MediaSource already disconnected');
                }
            }

            // Connect: audio -> analyser -> destination
            this.mediaSource.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);
            console.log('[AudioEngine] ✅ Audio chain connected');

            return true;
        } catch (error) {
            console.error('[AudioEngine] ❌ Init error:', error);
            return false;
        }
    }

    /**
     * Get current audio frame data
     * ZERO ALLOCATION - Reuses pre-allocated arrays
     *
     * @returns {object} Audio frame data
     */
    getFrameData() {
        if (!this.analyser || !this.rawDataArray || !this.spectrumArray) {
            // Return silent frame if not initialized
            return {
                spectrum: new Float32Array(this.binCount),
                energy: { bass: 0, mid: 0, high: 0, overall: 0 },
                beatPulse: 0
            };
        }

        // CRITICAL: Reuse existing array, don't create new one
        this.analyser.getByteFrequencyData(this.rawDataArray);

        // CRITICAL: Overwrite values in pre-allocated array
        for (let i = 0; i < this.binCount; i++) {
            this.spectrumArray[i] = this.rawDataArray[i] / 255;
        }

        // Calculate frequency bands
        const getAvg = (start, end) => {
            let sum = 0;
            for (let i = start; i < end; i++) {
                sum += this.spectrumArray[i] || 0;
            }
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
            spectrum: this.spectrumArray,  // Return cached array
            energy: { bass, mid, high, overall },
            beatPulse: this.currentPulse
        };
    }

    /**
     * Update audio element reference
     */
    setAudioElement(audioElement) {
        this.audio = audioElement;
    }

    /**
     * Cleanup and disconnect
     */
    destroy() {
        console.log('[AudioEngine] 🗑️ Destroying audio engine');

        if (this.mediaSource) {
            try {
                this.mediaSource.disconnect();
            } catch (e) {
                // Already disconnected
            }
        }

        if (this.analyser) {
            try {
                this.analyser.disconnect();
            } catch (e) {
                // Already disconnected
            }
        }

        // Memory leak fix: Close AudioContext to release system audio resources
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close().then(() => {
                console.log('[AudioEngine] 🔇 AudioContext closed');
            }).catch(error => {
                console.error('[AudioEngine] Error closing AudioContext:', error);
            });
        }

        this.rawDataArray = null;
        this.spectrumArray = null;
        this.audioContext = null;
    }
}

export default AudioEngine;
