/**
 * SHIFT Pattern - Curved rows of morphing dashes
 *
 * Inspired by elegant dashed segments flowing in gentle curves.
 * Dashes subtly change length and spacing, creating wave-like patterns through rhythm.
 * Delicate, hypnotic movement that invites contemplation.
 *
 * Design philosophy: Rhythmic subtlety - poetry through spacing and gaps.
 *
 * Audio mapping:
 * - Bass controls dash length (subtle stretching)
 * - Mid energy controls wave curvature
 * - Treble affects gap spacing between dashes
 * - Beat pulse creates gentle synchronized shifts
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {object} frame - Audio data frame
 * @param {object} noise - Noise generator instance
 */
export function drawShift(ctx, width, height, frame, noise) {
    const numRows = 25; // Curved rows of dashes
    const { spectrum, energy, beatPulse, isPlaying } = frame;

    ctx.lineCap = 'round';

    const baseDashLength = 12;
    const baseGap = 8;

    for (let row = 0; row < numRows; row++) {
        const t = row / numRows;
        const rowY = (row / numRows) * height;

        // Get frequency for this row (bass to treble gradient)
        const freqIndex = Math.floor(t * 25);
        const rowFreq = spectrum[freqIndex] || 0;

        // Calculate how many dashes fit in this row
        const totalLength = baseDashLength + baseGap;
        const numDashes = Math.ceil(width / totalLength);

        for (let d = 0; d < numDashes; d++) {
            const dashT = d / numDashes;
            const baseX = d * totalLength;

            // Gentle wave using Perlin noise
            const noiseVal = noise.perlin(
                baseX * 0.002 + frame.time * 0.08,
                row * 0.15 + frame.time * 0.05
            );

            // Very subtle vertical offset for wave effect
            const waveAmp = isPlaying ? 15 + energy.mid * 20 : 10;
            const yOffset = Math.sin(noiseVal * Math.PI * 2 + dashT * Math.PI) * waveAmp;

            const y = rowY + yOffset;

            // Subtle dash length variation
            const lengthVariation = isPlaying
                ? 1 + (rowFreq * 0.5) + (beatPulse * 0.2)
                : 1;

            const dashLength = baseDashLength * lengthVariation;

            // Gentle rotation based on curve
            const angle = isPlaying
                ? noiseVal * 0.3 + energy.mid * 0.2
                : noiseVal * 0.2;

            const x1 = baseX;
            const x2 = baseX + dashLength;

            const dx = Math.cos(angle);
            const dy = Math.sin(angle);

            const startX = x1 * dx - yOffset * dy;
            const startY = y;
            const endX = x2 * dx - yOffset * dy;
            const endY = y + (x2 - x1) * dy;

            // Delicate line style
            if (!isPlaying) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 1.0)';
                ctx.lineWidth = 1.0;
            } else {
                // Subtle opacity variation
                const alpha = 0.3 + (t * 0.3) + (rowFreq * 0.25);
                ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(0.8, alpha)})`;
                ctx.lineWidth = 0.8 + (rowFreq * 0.6);
            }

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }
    }
}

export const metadata = {
    name: 'Shift',
    description: 'Elegant curved rows of morphing dashes',
    author: 'MP3Player',
    responsive: true,
    optimized: true
};
