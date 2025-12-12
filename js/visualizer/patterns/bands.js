/**
 * BANDS Pattern - Horizontal zones of dancing line segments
 *
 * Horizontal bands filled with many short line segments that pulse and dance.
 * Creates ribbon-like zones where each segment responds to audio differently.
 * Dense segments fill the canvas creating dynamic horizontal layers.
 *
 * Audio mapping:
 * - Each band tied to specific frequency range
 * - Bass frequencies control bottom bands (long, thick segments)
 * - Treble frequencies control top bands (short, quick movements)
 * - Segment length and angle vary with audio intensity
 * - Beat pulse creates synchronized rotations
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {object} frame - Audio data frame
 * @param {object} noise - Noise generator instance
 */
export function drawBands(ctx, width, height, frame, noise) {
    const numBands = 6;
    const { spectrum, energy, beatPulse, isPlaying } = frame;

    ctx.lineCap = 'round';

    for (let i = 0; i < numBands; i++) {
        const t = i / numBands;
        const bandHeight = height / numBands;
        const yCenter = i * bandHeight + bandHeight / 2;

        // Frequency mapping
        const freqStart = Math.floor((1 - t) * 35);
        const freqRange = 8;

        let avgFreq = 0;
        for (let f = freqStart; f < freqStart + freqRange && f < spectrum.length; f++) {
            avgFreq += spectrum[f] || 0;
        }
        avgFreq /= freqRange;

        // Dense segments across the band
        const segmentSpacing = 12;
        const segmentsPerRow = Math.ceil(width / segmentSpacing);
        const numRows = Math.ceil(bandHeight / 10);

        for (let row = 0; row < numRows; row++) {
            const rowY = i * bandHeight + (row / numRows) * bandHeight;

            for (let seg = 0; seg < segmentsPerRow; seg++) {
                const x = seg * segmentSpacing;

                // Noise-based animation
                const noiseVal = noise.perlin(
                    x * 0.01 + frame.time * (0.2 + energy.mid * 0.3),
                    rowY * 0.01 + i * 0.2
                );

                // Segment angle based on audio
                const baseAngle = isPlaying
                    ? noiseVal * Math.PI * 2 + avgFreq * Math.PI + beatPulse * 0.5
                    : noiseVal * Math.PI * 0.5; // Gentle angle when frozen

                // Segment length based on audio
                const baseLength = 6 + t * 8;
                const length = isPlaying
                    ? baseLength * (0.5 + avgFreq * 1.5 + beatPulse * 0.5)
                    : baseLength * 0.6;

                const halfLen = length / 2;
                const x1 = x - Math.cos(baseAngle) * halfLen;
                const y1 = rowY - Math.sin(baseAngle) * halfLen;
                const x2 = x + Math.cos(baseAngle) * halfLen;
                const y2 = rowY + Math.sin(baseAngle) * halfLen;

                // Line style
                if (!isPlaying) {
                    ctx.strokeStyle = 'rgba(255, 255, 255, 1.0)';
                    ctx.lineWidth = 1.0;
                } else {
                    const alpha = 0.15 + (avgFreq * 0.7) + (beatPulse * 0.15);
                    ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, alpha)})`;
                    ctx.lineWidth = 0.6 + (avgFreq * 2.0) + (t * 0.5);
                }

                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
        }
    }
}

export const metadata = {
    name: 'Bands',
    description: 'Horizontal zones of dancing line segments pulsing with music',
    author: 'MP3Player',
    responsive: true,
    optimized: true
};
