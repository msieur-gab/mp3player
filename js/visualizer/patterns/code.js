/**
 * CODE Pattern - Horizontal dash grid with length-encoded waveform
 *
 * A structured grid of horizontal dashes where the LENGTH of each dash
 * encodes audio information, creating hidden forms and waveforms within
 * the rigid structure.
 *
 * Inspired by: adfa35385556cdca00bcfb6014cf8e77.jpg
 *
 * Audio mapping:
 * - Spectrum creates vertical "bands" of activity
 * - Dash length encodes the audio amplitude at that position
 * - Beat pulse creates momentary length expansions
 * - Overall energy affects the contrast between long/short dashes
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {object} frame - Audio data frame
 * @param {object} noise - Noise generator instance
 */
export function drawCode(ctx, width, height, frame, noise) {
    const { spectrum, energy, beatPulse, isPlaying } = frame;

    // Grid parameters
    const cols = 20;
    const rows = 35;
    const cellWidth = width / cols;
    const cellHeight = height / rows;
    const maxDashLength = cellWidth * 0.85;
    const minDashLength = cellWidth * 0.1;

    ctx.lineCap = 'round';

    for (let row = 0; row < rows; row++) {
        const y = row * cellHeight + cellHeight / 2;
        const rowNorm = row / rows;

        for (let col = 0; col < cols; col++) {
            const centerX = col * cellWidth + cellWidth / 2;
            const colNorm = col / cols;

            // Get frequency value for this column
            const freqIndex = Math.floor(colNorm * 50);
            const freqVal = spectrum[freqIndex] || 0;

            // Noise-based variation for organic feel
            const noiseVal = noise.perlin(
                col * 0.3 + frame.time * 0.05,
                row * 0.2 + frame.time * 0.03
            );

            // Calculate dash length
            let dashLength;
            if (!isPlaying) {
                // Idle: gentle noise-based variation
                const idleNoise = (noiseVal + 1) / 2; // 0-1
                dashLength = minDashLength + (maxDashLength - minDashLength) * (0.3 + idleNoise * 0.4);
            } else {
                // Playing: frequency encodes length
                const baseLength = minDashLength;
                const freqLength = freqVal * (maxDashLength - minDashLength) * 0.8;
                const beatLength = beatPulse * (maxDashLength - minDashLength) * 0.15;
                const noiseLength = (noiseVal + 1) / 2 * (maxDashLength - minDashLength) * 0.2;

                dashLength = baseLength + freqLength + beatLength + noiseLength;
            }

            dashLength = Math.min(maxDashLength, Math.max(minDashLength, dashLength));

            // Center the dash
            const x1 = centerX - dashLength / 2;
            const x2 = centerX + dashLength / 2;

            // Alpha based on length (longer = more visible)
            const lengthNorm = (dashLength - minDashLength) / (maxDashLength - minDashLength);
            const alpha = isPlaying
                ? 0.3 + lengthNorm * 0.55
                : 0.5 + lengthNorm * 0.4;

            // Thickness - subtle variation
            const thickness = isPlaying
                ? 1.0 + lengthNorm * 0.8
                : 1.2;

            ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(0.9, alpha)})`;
            ctx.lineWidth = thickness;
            ctx.beginPath();
            ctx.moveTo(x1, y);
            ctx.lineTo(x2, y);
            ctx.stroke();
        }
    }
}

export const metadata = {
    name: 'Code',
    description: 'Horizontal dash grid encoding audio as length variations',
    author: 'MP3Player',
    responsive: true,
    optimized: true
};
