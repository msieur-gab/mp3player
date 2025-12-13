/**
 * STRINGS Pattern - Vertical columns of segmented dashes
 *
 * Columns of short vertical dashes that vary in thickness based on frequency.
 * Bass thickens lower segments, mids affect middle, treble affects top.
 * Creates a waveform-like visualization through varying dash weights.
 *
 * Design philosophy: Musical notation through stroke weight.
 *
 * Audio mapping:
 * - Bass: Thickness of lower third segments
 * - Mids: Thickness of middle third segments
 * - Highs: Thickness of upper third segments
 * - Beat: Subtle horizontal displacement wave
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {object} frame - Audio data frame
 * @param {object} noise - Noise generator instance
 */
export function drawStrings(ctx, width, height, frame, noise) {
    const colSpacing = 12;
    const numCols = Math.ceil(width / colSpacing);
    const dashesPerCol = 30;
    const dashLength = 6;
    const dashGap = 4;
    const { spectrum, energy, beatPulse, isPlaying } = frame;

    ctx.lineCap = 'round';

    for (let col = 0; col < numCols; col++) {
        const baseX = col * colSpacing + colSpacing / 2;
        const colNorm = col / numCols;

        // Frequency for this column
        const freqIndex = Math.floor(colNorm * 40);
        const colFreq = spectrum[freqIndex] || 0;

        for (let d = 0; d < dashesPerCol; d++) {
            const dashNorm = d / dashesPerCol;
            const baseY = d * (dashLength + dashGap) + dashGap;

            // Determine which frequency band affects this dash
            let bandInfluence;
            if (dashNorm < 0.33) {
                // Upper third - treble
                bandInfluence = energy.high;
            } else if (dashNorm < 0.66) {
                // Middle third - mids
                bandInfluence = energy.mid;
            } else {
                // Lower third - bass
                bandInfluence = energy.bass;
            }

            // Subtle horizontal displacement from beat
            const wave = noise.perlin(
                col * 0.1 + frame.time * 0.1,
                d * 0.2 + frame.time * 0.08
            );

            const displacement = isPlaying
                ? wave * 4 + beatPulse * Math.sin(dashNorm * Math.PI) * 6
                : wave * 2;

            const x = baseX + displacement;

            // Thickness varies by frequency band
            let thickness;
            if (!isPlaying) {
                thickness = 1.0;
            } else {
                const baseThickness = 0.5;
                const freqThickness = bandInfluence * 2.5;
                const colThickness = colFreq * 1.0;
                thickness = baseThickness + freqThickness + colThickness;
                thickness = Math.min(3.5, thickness);
            }

            // Alpha - subtle variation
            const alpha = isPlaying
                ? 0.3 + bandInfluence * 0.4 + colFreq * 0.2
                : 0.7;

            // Length - slightly varies with audio
            const length = isPlaying
                ? dashLength + bandInfluence * 3
                : dashLength;

            ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(0.85, alpha)})`;
            ctx.lineWidth = thickness;
            ctx.beginPath();
            ctx.moveTo(x, baseY);
            ctx.lineTo(x, baseY + length);
            ctx.stroke();
        }
    }
}

export const metadata = {
    name: 'Strings',
    description: 'Vertical dashes with frequency-driven thickness',
    author: 'MP3Player',
    responsive: true,
    optimized: true
};
