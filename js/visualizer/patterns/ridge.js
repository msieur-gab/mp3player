/**
 * RIDGE Pattern - Layered mountain ridges with overlapping curves
 *
 * Multiple smooth organic curves creating layered mountain ridges.
 * Each ridge line represents a different terrain layer with traveling peaks.
 * Creates depth through overlapping lines at varying opacities.
 *
 * Audio mapping:
 * - Bass energy controls overall ridge height
 * - Mid energy controls horizontal movement of peaks
 * - Treble energy adds fine ripples and detail
 * - Beat pulse creates synchronized ridge elevations
 * - Spectrum data creates traveling peaks across ridges
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {object} frame - Audio data frame
 * @param {object} noise - Noise generator instance
 */
export function drawRidge(ctx, width, height, frame, noise) {
    const numRidges = 8; // Multiple overlapping ridge lines
    const { spectrum, energy, beatPulse, isPlaying } = frame;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const moveSpeed = isPlaying ? energy.mid * 1.5 : 0;

    // Draw ridges from back to front for depth
    for (let ridge = 0; ridge < numRidges; ridge++) {
        const ridgeT = ridge / numRidges;
        const baseY = height * (0.3 + ridgeT * 0.5); // Distribute ridges vertically

        ctx.beginPath();

        for (let x = 0; x <= width; x += 4) {
            const xNorm = x / width;

            // Create traveling peaks using spectrum data
            let elevation = 0;
            const numPeaks = 3;

            for (let p = 0; p < numPeaks; p++) {
                const freqIndex = Math.floor((p / numPeaks) * 40);
                const freqVal = spectrum[freqIndex] || 0;

                // Each ridge has slightly different peak timing
                const peakPos = ((frame.time * (0.06 + p * 0.04 + ridge * 0.01) + p * 0.33 + ridge * 0.1) % 1);
                const distFromPeak = Math.abs(xNorm - peakPos);

                // Smooth falloff
                const influence = Math.exp(-distFromPeak * distFromPeak * 12);
                elevation += freqVal * influence;
            }

            // Base terrain using Perlin noise (different phase per ridge)
            const noiseVal = noise.perlin(
                x * 0.0025 + frame.time * (0.08 + moveSpeed * 0.12),
                ridge * 0.3
            );

            // Combine influences
            const baseAmp = isPlaying
                ? (20 + ridgeT * 40 + energy.bass * 60)
                : (12 + ridgeT * 20); // Gentle ridges when frozen

            const trebleDetail = isPlaying
                ? Math.sin(x * 0.06 + frame.time * 2.5 + ridge) * energy.high * 6
                : 0;

            const totalElevation = (noiseVal * 0.5 + elevation * 0.5 + beatPulse * 0.25) * baseAmp;

            const y = baseY - totalElevation + trebleDetail;

            if (x === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        // Line style - vary by ridge depth for layering effect
        if (!isPlaying) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 1.0)';
            ctx.lineWidth = 1.2;
        } else {
            // Back ridges more transparent, front ridges more opaque
            const alpha = 0.2 + (ridgeT * 0.5) + (energy.bass * 0.2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, alpha)})`;
            ctx.lineWidth = 0.8 + (ridgeT * 1.5) + (energy.bass * 0.8);
        }

        ctx.stroke();
    }
}

export const metadata = {
    name: 'Ridge',
    description: 'Layered mountain ridges with overlapping dynamic curves',
    author: 'MP3Player',
    responsive: true,
    optimized: true
};
