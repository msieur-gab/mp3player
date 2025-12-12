/**
 * GRID Pattern - Rotating crosses
 *
 * A grid of vertical lines that rotate based on noise and audio intensity.
 * Creates a kinetic, mechanical field of synchronized motion.
 *
 * Audio mapping:
 * - Bass frequencies control the top arm length
 * - Treble frequencies control the bottom arm length
 * - Overall bass energy modulates rotation speed
 * - Vertical position (t) adds depth gradient
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {object} frame - Audio data frame
 * @param {object} noise - Noise generator instance
 */
export function drawGrid(ctx, width, height, frame, noise) {
    // OPTIMIZATION 4: Reduce grid density on mobile
    const baseGridStep = 25;
    const gridStep = baseGridStep / (frame.qualityMultiplier || 1);
    const { spectrum, energy, isPlaying } = frame;
    ctx.lineCap = 'round';

    // OPTIMIZATION 5: Cache state settings to avoid redundant calls
    for (let y = gridStep/2; y < height; y += gridStep) {
        const t = y / height;

        for (let x = gridStep/2; x < width; x += gridStep) {
            const noiseVal = noise.perlin(x * 0.005, y * 0.005 + frame.time * 0.1);
            const angle = noiseVal * Math.PI * 2 + (energy.bass * 0.5);
            const bassVal = spectrum[Math.floor((x/width)*20)] || 0;
            const trebleVal = spectrum[Math.floor(spectrum.length - 20 + (x/width)*20)] || 0;

            const lenTop = 5 + (t * 4) + (bassVal * 20);
            const lenBot = 5 + (t * 4) + (trebleVal * 15);

            // Calculate line endpoints with rotation (avoiding save/restore)
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);
            const x1 = x + (0 * cosA - (-lenTop) * sinA);
            const y1 = y + (0 * sinA + (-lenTop) * cosA);
            const x2 = x + (0 * cosA - lenBot * sinA);
            const y2 = y + (0 * sinA + lenBot * cosA);

            if (!isPlaying) {
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = `rgba(255, 255, 255, 1.0)`;
            } else {
                let th = 0.5 + (t * 1.0) + (bassVal * 2.5 * t);
                ctx.lineWidth = Math.min(4.0, th);
                ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 + bassVal * 0.9})`;
            }

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
    }
}

export const metadata = {
    name: 'Grid',
    description: 'Rotating vertical lines creating a kinetic mechanical field',
    author: 'MP3Player',
    responsive: true,
    optimized: true
};
