/**
 * FLOW Pattern - Organic topographic contours
 *
 * Inspired by topographic elevation maps with gentle flowing contour lines.
 * Lines subtly wrap around invisible audio peaks, creating a fragile, poetic landscape.
 * Delicate movements that breathe with the music rather than react aggressively.
 *
 * Design philosophy: Subtle, fragile, poetic - triggering imagination through gentleness.
 *
 * Audio mapping:
 * - Bass creates gentle focal points (peaks) that lines flow around
 * - Mid energy controls subtle horizontal drift
 * - Treble adds barely-visible ripples
 * - Beat pulse creates delicate elevation changes
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {object} frame - Audio data frame
 * @param {object} noise - Noise generator instance
 */
export function drawFlow(ctx, width, height, frame, noise) {
    const numLines = 40; // Dense contours
    const { spectrum, energy, beatPulse, isPlaying } = frame;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Very subtle movement
    const drift = isPlaying ? energy.mid * 0.3 : 0;

    for (let i = 0; i < numLines; i++) {
        const t = i / numLines;
        const baseY = (i / numLines) * height;

        ctx.beginPath();

        for (let x = 0; x <= width; x += 4) {
            const xNorm = x / width;

            // Create 2-3 subtle focal points from bass frequencies
            let elevation = 0;
            const numPeaks = 2;

            for (let p = 0; p < numPeaks; p++) {
                const freqIndex = Math.floor(p * 15); // Low frequencies only
                const freqVal = spectrum[freqIndex] || 0;

                // Peaks drift very slowly across canvas
                const peakPos = ((frame.time * 0.03 + p * 0.5) % 1);
                const distFromPeak = Math.abs(xNorm - peakPos);

                // Very gentle gaussian falloff
                const influence = Math.exp(-distFromPeak * distFromPeak * 8);
                elevation += freqVal * influence * 0.4; // Subtle influence
            }

            // Base gentle wave using Perlin noise
            const noiseVal = noise.perlin(
                x * 0.001 + frame.time * (0.05 + drift * 0.1),
                i * 0.08 + frame.time * 0.02
            );

            // Very subtle amplitude - fragile movements
            const baseAmp = isPlaying ? 8 + energy.bass * 12 : 6;

            // Barely-visible treble detail
            const trebleDetail = isPlaying
                ? Math.sin(x * 0.04 + frame.time * 1.5) * energy.high * 3
                : 0;

            // Combine with gentleness
            const totalElevation = (noiseVal * 0.6 + elevation * 0.4 + beatPulse * 0.15) * baseAmp;

            const y = baseY + totalElevation + trebleDetail;

            if (x === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        // Delicate line style - subtle transparency variation
        if (!isPlaying) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 1.0)';
            ctx.lineWidth = 0.8;
        } else {
            // Very subtle opacity changes
            const alpha = 0.25 + (t * 0.25) + (energy.bass * 0.15);
            ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(0.7, alpha)})`;
            ctx.lineWidth = 0.6 + (energy.bass * 0.4);
        }

        ctx.stroke();
    }
}

export const metadata = {
    name: 'Flow',
    description: 'Gentle topographic contours flowing around audio peaks',
    author: 'MP3Player',
    responsive: true,
    optimized: true
};
