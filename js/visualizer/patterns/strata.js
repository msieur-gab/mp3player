/**
 * STRATA Pattern - Horizontal bars breathing with music
 *
 * Rows of horizontal bars where each row responds to its frequency band.
 * Gap positions shift gently, bar lengths pulse with amplitude.
 * Creates a living score - each row a voice in the harmony.
 *
 * Design philosophy: Musical staves - each row sings its frequency.
 *
 * Audio mapping:
 * - Each row maps to a frequency (bass at bottom, treble at top)
 * - Row's frequency controls its bar length and opacity
 * - Beat creates synchronized breathing
 * - Noise provides organic gap positioning
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {object} frame - Audio data frame
 * @param {object} noise - Noise generator instance
 */
export function drawStrata(ctx, width, height, frame, noise) {
    const rowSpacing = 10;
    const numRows = Math.ceil(height / rowSpacing);
    const { spectrum, energy, beatPulse, isPlaying } = frame;

    const barHeight = rowSpacing * 0.4;
    const margin = width * 0.05;

    ctx.lineCap = 'round';

    for (let row = 0; row < numRows; row++) {
        const y = row * rowSpacing + rowSpacing / 2;
        const rowNorm = row / numRows;

        // Frequency mapping - bass at bottom (rowNorm = 1), treble at top (rowNorm = 0)
        const freqIndex = Math.floor((1 - rowNorm) * 40);
        const rowFreq = spectrum[freqIndex] || 0;

        // Gap position oscillates gently with noise and audio
        const gapNoise = noise.perlin(row * 0.12, frame.time * 0.06);
        const gapCenter = 0.5 + gapNoise * 0.25;

        // Gap width - wider when quiet, tighter when loud
        const gapWidth = isPlaying
            ? 20 + (1 - rowFreq) * 30 - beatPulse * 10
            : 35;

        // Bar extends from margins toward center gap
        const contentWidth = width - margin * 2;
        const gapStart = margin + contentWidth * gapCenter - gapWidth / 2;
        const gapEnd = margin + contentWidth * gapCenter + gapWidth / 2;

        // Thickness pulses with frequency
        const thickness = isPlaying
            ? barHeight * (0.6 + rowFreq * 0.6 + beatPulse * 0.2)
            : barHeight;

        // Alpha - rows with more signal are brighter
        const alpha = isPlaying
            ? 0.25 + rowFreq * 0.5 + (1 - rowNorm) * 0.15
            : 0.6 + (1 - rowNorm) * 0.3;

        ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(0.85, alpha)})`;
        ctx.lineWidth = Math.min(barHeight * 1.2, thickness);

        // Left bar
        if (gapStart > margin + 2) {
            ctx.beginPath();
            ctx.moveTo(margin, y);
            ctx.lineTo(gapStart, y);
            ctx.stroke();
        }

        // Right bar
        if (gapEnd < width - margin - 2) {
            ctx.beginPath();
            ctx.moveTo(gapEnd, y);
            ctx.lineTo(width - margin, y);
            ctx.stroke();
        }
    }
}

export const metadata = {
    name: 'Strata',
    description: 'Horizontal bars breathing with musical frequencies',
    author: 'MP3Player',
    responsive: true,
    optimized: true
};
