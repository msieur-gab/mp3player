/**
 * TERRAIN Pattern - Topographic elevation map with contour lines
 *
 * Dense horizontal wavy lines like topographic contours that deform with music.
 * Creates a dynamic terrain elevation effect where audio shapes the landscape.
 * Lines compress and spread to show "peaks" and "valleys".
 *
 * Audio mapping:
 * - Bass energy controls major elevation changes (peak height)
 * - Mid energy controls horizontal movement of terrain features
 * - Treble energy adds fine detail ripples
 * - Beat pulse creates synchronized elevation spikes
 * - Spectrum data creates traveling peaks across the terrain
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {object} frame - Audio data frame
 * @param {object} noise - Noise generator instance
 */
export function drawTerrain(ctx, width, height, frame, noise) {
    const numLines = 30; // Dense contour lines
    const { spectrum, energy, beatPulse, isPlaying } = frame;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const moveSpeed = isPlaying ? energy.mid * 1.5 : 0;

    for (let i = 0; i < numLines; i++) {
        const t = i / numLines;
        const baseY = (i / numLines) * height;

        ctx.beginPath();

        for (let x = 0; x <= width; x += 5) {
            const xNorm = x / width;

            // Create traveling peaks using spectrum data
            let elevation = 0;
            const numPeaks = 4;

            for (let p = 0; p < numPeaks; p++) {
                const freqIndex = Math.floor((p / numPeaks) * 40);
                const freqVal = spectrum[freqIndex] || 0;

                // Peak position moves with time
                const peakPos = ((frame.time * (0.08 + p * 0.03) + p * 0.25) % 1);
                const distFromPeak = Math.abs(xNorm - peakPos);

                // Smooth falloff around peak
                const influence = Math.exp(-distFromPeak * distFromPeak * 15);
                elevation += freqVal * influence;
            }

            // Base terrain using Perlin noise
            const noiseVal = noise.perlin(
                x * 0.002 + frame.time * (0.1 + moveSpeed * 0.15),
                i * 0.1
            );

            // Combine all influences
            const baseAmp = isPlaying
                ? (25 + energy.bass * 50)
                : 15; // Gentle terrain when frozen

            const trebleDetail = isPlaying
                ? Math.sin(x * 0.08 + frame.time * 3) * energy.high * 8
                : 0;

            const totalElevation = (noiseVal * 0.4 + elevation * 0.6 + beatPulse * 0.3) * baseAmp;

            // Y position: base line + elevation offset
            const y = baseY + totalElevation + trebleDetail;

            if (x === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        // Line style
        if (!isPlaying) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 1.0)';
            ctx.lineWidth = 1.0;
        } else {
            // Vary opacity and thickness based on position and audio
            const alpha = 0.2 + (t * 0.4) + (energy.bass * 0.3);
            ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, alpha)})`;
            ctx.lineWidth = 0.8 + (energy.bass * 1.5);
        }

        ctx.stroke();
    }
}

export const metadata = {
    name: 'Terrain',
    description: 'Topographic elevation map with dynamic contour lines',
    author: 'MP3Player',
    responsive: true,
    optimized: true
};
