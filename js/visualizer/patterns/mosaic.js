/**
 * MOSAIC Pattern - Kinetic halftone dots
 *
 * A grid of morphing shapes that transition between squares and circles.
 * Creates a halftone, pointillist effect with audio-reactive size and morphing.
 *
 * Audio mapping:
 * - Each row is tied to a specific frequency band
 * - Bass frequencies at bottom, treble at top
 * - Audio intensity controls size (0.5-4.0 pixels)
 * - High intensity morphs squares into circles
 * - Beat pulse adds synchronized expansion
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {object} frame - Audio data frame
 * @param {object} noise - Noise generator instance
 */
export function drawMosaic(ctx, width, height, frame, noise) {
    // OPTIMIZATION 4: Reduce grid density on mobile (16 -> 32 size = 75% fewer cells)
    const baseGridSize = 16;
    const gridSize = baseGridSize / (frame.qualityMultiplier || 1);
    const cols = Math.ceil(width / gridSize);
    const rows = Math.ceil(height / gridSize);
    const { spectrum, beatPulse, isPlaying } = frame;

    for (let r = 0; r < rows; r++) {
        const t = r / (rows - 1);
        const freqIndex = Math.floor((1 - t) * 40);
        const rowVal = spectrum[freqIndex] || 0;

        for (let c = 0; c < cols; c++) {
            const cx = c * gridSize + gridSize/2;
            const cy = r * gridSize + gridSize/2;
            const noiseVal = noise.perlin(c * 0.1, r * 0.1 + frame.time);
            const val = rowVal * (0.8 + noiseVal * 0.4) + (beatPulse * 0.2 * t);

            let size;
            if (!isPlaying) {
                size = 2.0;
                ctx.fillStyle = `rgba(255, 255, 255, 0.3)`;
            } else {
                size = 0.5 + (val * 3.5);
                size = Math.max(0.5, Math.min(4.0, size));
                ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + val * 0.7})`;
            }

            const maxRad = size / 2;
            const morph = Math.min(1, val * 1.8);

            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(cx - size/2, cy - size/2, size, size, maxRad * morph);
            } else {
                if (val > 0.5) {
                    ctx.arc(cx, cy, size/2, 0, Math.PI*2);
                } else {
                    ctx.rect(cx - size/2, cy - size/2, size, size);
                }
            }
            ctx.fill();
        }
    }
}

export const metadata = {
    name: 'Mosaic',
    description: 'Kinetic halftone grid morphing between squares and circles',
    author: 'MP3Player',
    responsive: true,
    optimized: true
};
