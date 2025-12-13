/**
 * RAYS Pattern - Grid of lines pointing to center
 *
 * A grid of line segments that always point towards the center of the screen.
 * Creates a "warp speed" or "tunnel" effect but constrained to a rigid grid.
 *
 * Audio mapping:
 * - Length: Audio intensity extends the lines towards center
 * - Thickness: Bass increases line weight
 * - Offset: Beat pulse pushes lines away from center slightly
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {object} frame - Audio data frame
 * @param {object} noise - Noise generator instance
 */
export function drawRays(ctx, width, height, frame, noise) {
    // OPTIMIZATION: Grid density
    const baseGridStep = 30;
    const gridStep = baseGridStep / (frame.qualityMultiplier || 1);
    
    const centerX = width / 2;
    const centerY = height / 2;
    const maxDist = Math.hypot(centerX, centerY);
    
    const { spectrum, energy, beatPulse, isPlaying } = frame;
    
    ctx.lineCap = 'round';

    for (let y = gridStep / 2; y < height; y += gridStep) {
        for (let x = gridStep / 2; x < width; x += gridStep) {
            // Calculate angle to center
            const dx = centerX - x;
            const dy = centerY - y;
            const dist = Math.hypot(dx, dy);
            const angle = Math.atan2(dy, dx);
            
            // Normalize distance (0 at center, 1 at corner)
            const normDist = dist / maxDist;
            
            // Get frequency based on distance from center (Radial mapping)
            // Center = Highs, Edges = Bass
            const freqIndex = Math.floor(normDist * 40);
            const audioVal = spectrum[freqIndex] || 0;

            // Noise for subtle jitter
            const jitter = noise.perlin(x * 0.01, y * 0.01 + frame.time * 0.2);

            let length = gridStep * 0.2;
            let thickness = 1.2;
            let alpha = 0.3;

            if (isPlaying) {
                // Length responds to audio
                length = gridStep * (0.2 + audioVal * 0.8 + energy.mid * 0.4);
                
                // Beat push
                const push = beatPulse * 10 * (1 - normDist); // Stronger at center
                
                // Thickness
                thickness = 1.0 + (audioVal * 2.5);
                alpha = 0.2 + (audioVal * 0.8);
            }

            // Limit length to prevent overlap
            length = Math.min(length, gridStep * 0.9);

            // Draw line
            const x1 = x;
            const y1 = y;
            const x2 = x + Math.cos(angle) * length;
            const y2 = y + Math.sin(angle) * length;

            ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, alpha)})`;
            ctx.lineWidth = Math.min(4, thickness);
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
    }
}

export const metadata = {
    name: 'Rays',
    description: 'Grid of lines pointing to center (Tunnel effect)',
    author: 'MP3Player',
    responsive: true,
    optimized: true
};
