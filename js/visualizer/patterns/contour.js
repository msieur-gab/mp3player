/**
 * CONTOUR Pattern - Topographic elevation lines
 *
 * Horizontal lines that gently bend around invisible audio-driven peaks,
 * like contour lines wrapping around mountains on a topographic map.
 * Multiple focal points create complex, organic terrain.
 *
 * Design philosophy: Poetic cartography - mapping sound as landscape.
 *
 * Audio mapping:
 * - Bass creates focal points (peaks) that lines wrap around
 * - Mids control subtle drift of peak positions
 * - Highs add delicate ripples
 * - Beat pulse gently elevates the terrain
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {object} frame - Audio data frame
 * @param {object} noise - Noise generator instance
 */
export function drawContour(ctx, width, height, frame, noise) {
    const numLines = 35;
    const { spectrum, energy, beatPulse, isPlaying } = frame;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Define 3-4 focal points that lines will wrap around
    const numPeaks = 3;
    const peaks = [];

    for (let p = 0; p < numPeaks; p++) {
        // Peaks drift slowly across canvas
        const peakNoise = noise.perlin(p * 10, frame.time * 0.03);
        const peakX = (0.2 + p * 0.3 + peakNoise * 0.15) * width;

        // Vertical position also drifts
        const peakYNoise = noise.perlin(p * 10 + 100, frame.time * 0.02);
        const peakY = (0.3 + p * 0.2 + peakYNoise * 0.2) * height;

        // Peak strength from bass frequencies
        const freqIndex = Math.floor(p * 8);
        const freqVal = spectrum[freqIndex] || 0;
        const strength = isPlaying
            ? 30 + freqVal * 60 + energy.bass * 40 + beatPulse * 20
            : 25;

        peaks.push({ x: peakX, y: peakY, strength });
    }

    for (let i = 0; i < numLines; i++) {
        const t = i / numLines;
        const baseY = t * height;

        ctx.beginPath();

        for (let x = 0; x <= width; x += 4) {
            const xNorm = x / width;

            // Calculate elevation from all peaks
            let elevation = 0;

            for (const peak of peaks) {
                const dx = x - peak.x;
                const dy = baseY - peak.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Gaussian falloff from peak
                const influence = Math.exp(-(dist * dist) / (peak.strength * peak.strength * 2));
                elevation += influence * peak.strength * 0.5;
            }

            // Add subtle noise-based undulation
            const noiseVal = noise.perlin(
                x * 0.002 + frame.time * 0.05,
                i * 0.1 + frame.time * 0.03
            );

            const noiseElevation = noiseVal * (isPlaying ? 8 + energy.mid * 10 : 6);

            // Treble adds tiny ripples
            const trebleRipple = isPlaying
                ? Math.sin(x * 0.03 + frame.time * 0.8) * energy.high * 3
                : 0;

            const y = baseY - elevation + noiseElevation + trebleRipple;

            if (x === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        // Delicate line style
        if (!isPlaying) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 0.8;
        } else {
            const alpha = 0.25 + t * 0.25 + energy.bass * 0.2;
            ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(0.7, alpha)})`;
            ctx.lineWidth = 0.6 + energy.bass * 0.5;
        }

        ctx.stroke();
    }
}

export const metadata = {
    name: 'Contour',
    description: 'Topographic lines wrapping around audio peaks',
    author: 'MP3Player',
    responsive: true,
    optimized: true
};
