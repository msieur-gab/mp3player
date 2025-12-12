/**
 * HORIZON Pattern - Horizontal wavy strings
 *
 * Stacked horizontal lines that wave and undulate based on audio frequencies.
 * Creates a landscape-like horizon effect with depth perception through line thickness.
 *
 * Audio mapping:
 * - Each horizontal line is tied to a specific frequency band
 * - Bass frequencies at bottom (thick lines), treble at top (thin lines)
 * - Wave amplitude responds to frequency intensity
 * - Beat pulse adds synchronized movement
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {object} frame - Audio data frame
 * @param {object} noise - Noise generator instance
 */
export function drawHorizon(ctx, width, height, frame, noise) {
    // OPTIMIZATION 4: Reduce line count on mobile (24 -> 12 lines)
    const baseNumLines = 24;
    const numLines = Math.floor(baseNumLines * (frame.qualityMultiplier || 1));
    const { spectrum, beatPulse, isPlaying } = frame;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < numLines; i++) {
        const t = i / 19;
        const yBase = 20 + Math.pow(t, 1.2) * (height - 40);
        const safeT = Math.min(1, t);
        const freqIndex = Math.floor((1 - safeT) * 30);
        const baseVal = spectrum[freqIndex] || 0;

        ctx.beginPath();
        for (let x = 0; x <= width; x += 8) {
            const noiseVal = noise.perlin(x * 0.003 + frame.time * 0.1, yBase * 0.003);
            const xVal = spectrum[Math.floor((x/width) * spectrum.length)] || 0;
            const amp = (5 + t * 20) * (0.5 + baseVal + xVal * 0.5 + beatPulse * 0.2);
            const yOffset = Math.sin(noiseVal * Math.PI * 4 + frame.time) * amp;

            if (x === 0) {
                ctx.moveTo(x, yBase + yOffset);
            } else {
                ctx.lineTo(x, yBase + yOffset);
            }
        }

        if (!isPlaying) {
            ctx.lineWidth = 1.5;
        } else {
            ctx.lineWidth = Math.min(4.0, 0.5 + (t * 2.0) + (beatPulse * 1.5));
        }

        const alpha = !isPlaying ? 1.0 : (0.2 + (t * 0.6) + (baseVal * 0.4));
        ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, alpha)})`;
        ctx.stroke();
    }
}

export const metadata = {
    name: 'Horizon',
    description: 'Stacked wavy horizontal lines creating a landscape-like effect',
    author: 'MP3Player',
    responsive: true,
    optimized: true
};
