/**
 * FLUX Pattern - Dense field of dashes creating wave patterns
 *
 * Inspired by rain patterns, wave interference, flowing particles.
 * Creates a dense field of small white dashes that form organic wave patterns.
 *
 * Design philosophy: Dense particle field, wave formation, organic flow.
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {object} frame - Audio data frame
 * @param {object} noise - Noise generator instance
 */
export function drawFlux(ctx, width, height, frame, noise) {
    const { spectrum, energy, beatPulse, isPlaying } = frame;

    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255, 255, 255, 1.0)';

    // Dense vertical spacing
    const spacing = 8;
    const numLines = Math.ceil(width / spacing);

    // Number of dashes per vertical column
    const dashesPerColumn = 25;
    const dashLength = 6;
    const dashSpacing = height / dashesPerColumn;

    for (let i = 0; i < numLines; i++) {
        const x = i * spacing;
        const lineT = i / numLines;

        // Get frequency for this column
        const freqIndex = Math.floor(lineT * 40);
        const freqVal = spectrum[freqIndex] || 0;

        for (let d = 0; d < dashesPerColumn; d++) {
            const dashT = d / dashesPerColumn;
            const baseY = d * dashSpacing;

            // Create wave pattern using multiple sine waves and noise
            const wave1 = Math.sin((lineT * Math.PI * 4) + (isPlaying ? frame.time * 1.2 : 0));
            const wave2 = Math.sin((lineT * Math.PI * 2) + (dashT * Math.PI * 3) + (isPlaying ? frame.time * 0.8 : 0));

            const noiseVal = noise.perlin(
                i * 0.15 + (isPlaying ? frame.time * 0.3 : 0),
                d * 0.2 + (isPlaying ? frame.time * 0.2 : 0)
            );

            // Combine waves and noise to determine if dash should be drawn
            const waveInfluence = (wave1 + wave2) * 0.5 + noiseVal;
            const threshold = isPlaying ? -0.3 + freqVal * 0.8 : 0.2;

            if (waveInfluence > threshold) {
                // Vertical offset based on wave
                const yOffset = waveInfluence * (isPlaying ? (10 + freqVal * 20) : 5);
                const y = baseY + yOffset;

                // Length varies with audio
                const length = isPlaying ? (dashLength + freqVal * 8 + beatPulse * 4) : dashLength;

                // Thickness varies slightly
                const thickness = isPlaying ? (1.0 + freqVal * 2) : 1.0;

                // Opacity varies with position and audio
                const alpha = isPlaying ? (0.6 + freqVal * 0.4) : 1.0;

                ctx.beginPath();
                ctx.moveTo(x, y - length / 2);
                ctx.lineTo(x, y + length / 2);
                ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, alpha)})`;
                ctx.lineWidth = thickness;
                ctx.stroke();
            }
        }
    }
}

export const metadata = {
    name: 'Flux',
    description: 'Dense field of dashes creating organic wave patterns',
    author: 'MP3Player',
    responsive: true,
    optimized: true
};
