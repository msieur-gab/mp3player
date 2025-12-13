/**
 * VIBE Pattern - Radial Grid Ripples
 *
 * A grid of dots that scale and pulse based on radial waves from the center.
 * Combines the structure of 'Mosaic' with the motion of 'Pulse'.
 *
 * Audio mapping:
 * - Bass: Triggers a strong shockwave from center
 * - Mids: Controls the decay of the wave (how far it reaches)
 * - Highs: Adds sparkle/jitter to individual dots
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {object} frame - Audio data frame
 * @param {object} noise - Noise generator instance
 */
export function drawVibe(ctx, width, height, frame, noise) {
    const { spectrum, energy, beatPulse, isPlaying } = frame;
    
    // Grid Setup
    const gridSize = 25 / (frame.qualityMultiplier || 1);
    const cols = Math.ceil(width / gridSize);
    const rows = Math.ceil(height / gridSize);
    
    const centerX = width / 2;
    const centerY = height / 2;
    const maxDist = Math.hypot(centerX, centerY);

    // Wave parameters
    const waveSpeed = 8.0;
    const wavePhase = frame.time * waveSpeed;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const x = c * gridSize + gridSize/2;
            const y = r * gridSize + gridSize/2;
            
            const dx = x - centerX;
            const dy = y - centerY;
            const dist = Math.hypot(dx, dy);
            const normDist = dist / maxDist; // 0..1

            // Wave calculation
            // Distance - Time = Outward movement
            const waveVal = Math.sin(dist * 0.05 - wavePhase);
            
            // Size calculation
            let size = 2.0;
            let alpha = 0.3;

            if (isPlaying) {
                // Audio boosts the wave peaks
                // Beat pulse adds a global flash
                const audioBoost = (waveVal > 0) ? energy.bass * 4.0 : 0;
                
                // Frequency mapping (radial)
                const freqIndex = Math.floor(normDist * 30);
                const freqVal = spectrum[freqIndex] || 0;

                size = 2.0 + audioBoost + (freqVal * 6.0);
                alpha = 0.2 + (freqVal * 0.8) + (beatPulse * 0.2);
                
                // High frequency jitter
                if (energy.high > 0.5) {
                    size += Math.random() * energy.high * 2;
                }
            } else {
                // Idle breathing
                size = 2.0 + waveVal * 1.0;
                alpha = 0.3 + waveVal * 0.1;
            }

            // Draw Dot
            // Square vs Circle morphing based on intensity (like Mosaic)
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, alpha)})`;
            ctx.beginPath();
            
            if (size > 4.0) {
                // High energy = Circle
                ctx.arc(x, y, size/2, 0, Math.PI*2);
            } else {
                // Low energy = Square
                ctx.rect(x - size/2, y - size/2, size, size);
            }
            ctx.fill();
        }
    }
}

export const metadata = {
    name: 'Vibe',
    description: 'Radial grid of pulsing dots and shockwaves',
    author: 'MP3Player',
    responsive: true,
    optimized: true
};
