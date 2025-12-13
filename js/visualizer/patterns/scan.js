/**
 * SCAN Pattern - Horizontal segments in aligned grid
 *
 * Grid of horizontal dashes where segment length and thickness respond to music.
 * All segments left-aligned within columns at fixed row positions.
 * Thickness inversely proportional to gap. Alpha controlled by audio.
 *
 * Inspired by: adfa35385556cdca00bcfb6014cf8e77.jpg
 *
 * Audio mapping:
 * - Existence: some segments appear/disappear based on audio + noise
 * - Thickness: thick when gap big, thin when gap small
 * - Alpha: 0.15-1.0 based on audio (Breath-style)
 * - Segment length varies with audio
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {object} frame - Audio data frame
 * @param {object} noise - Noise generator instance
 */
export function drawScan(ctx, width, height, frame, noise) {
    const { spectrum, energy, beatPulse, isPlaying } = frame;

    // Grid parameters - fixed structure for even distribution
    const numCols = 16;
    const numRows = 32;
    const margin = width * 0.05;
    const marginY = height * 0.03;

    const availableWidth = width - margin * 2;
    const availableHeight = height - marginY * 2;

    const colSpacing = availableWidth / numCols;
    const rowSpacing = availableHeight / numRows;

    // Fixed segment length
    const segLength = colSpacing * 0.8;

    ctx.lineCap = 'round';

    for (let col = 0; col < numCols; col++) {
        const colLeft = margin + col * colSpacing;
        const colNorm = col / numCols;

        // Each column maps to different frequency band
        const freqIndex = Math.floor(colNorm * 50);
        const colFreq = spectrum[freqIndex] || 0;

        // Column phase offset (like CASCADE)
        const colPhase = noise.perlin(col * 0.08, 0) * Math.PI * 2;

        // Horizontal wave variation per column
        const hWave1 = Math.sin(colNorm * Math.PI * 3 + frame.time * 0.2 + colPhase);
        const hWave2 = Math.sin(colNorm * Math.PI * 5 - frame.time * 0.15);
        const horizontalActivity = (hWave1 + hWave2) / 2;

        for (let row = 0; row < numRows; row++) {
            // Fixed Y position for even distribution
            const y = marginY + row * rowSpacing + rowSpacing / 2;
            const rowNorm = row / numRows;

            // Vertical wave variation per segment (like CASCADE)
            const vWaveSpeed = isPlaying ? 0.3 + energy.mid * 0.2 : 0.1;
            const vWave = Math.sin(rowNorm * Math.PI * 4 - frame.time * vWaveSpeed + colPhase);
            const vWave2 = Math.sin(rowNorm * Math.PI * 2 + frame.time * 0.15 + col * 0.1);
            const verticalActivity = (vWave + vWave2) / 2;

            // Existence check (like CASCADE)
            const existenceNoise = noise.perlin(
                col * 0.15 + frame.time * 0.08,
                row * 0.25 + frame.time * 0.05
            );

            const waveBonus = (horizontalActivity + verticalActivity) * 0.25;
            const densityThreshold = isPlaying
                ? rowNorm * 0.7 - colFreq * 0.4 - beatPulse * 0.25 - waveBonus
                : rowNorm * 0.6 - waveBonus * 0.5;

            if (existenceNoise < densityThreshold) {
                continue;
            }

            // Thickness based on wave activity + column frequency
            const waveAlpha = (horizontalActivity + verticalActivity + 2) / 4;
            let thickness;
            if (!isPlaying) {
                thickness = 1.5;
            } else {
                thickness = 0.5 + colFreq * 2.5 + waveAlpha * 1.0;
            }

            // Alpha (Breath-style per segment)
            const segFreqIndex = Math.floor((1 - rowNorm) * 40);
            const segFreq = spectrum[segFreqIndex] || 0;

            const alpha = !isPlaying
                ? 0.8
                : 0.15 + segFreq * 0.6 + colFreq * 0.25;

            ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(0.95, alpha)})`;
            ctx.lineWidth = Math.min(4, thickness);
            ctx.beginPath();
            ctx.moveTo(colLeft, y);
            ctx.lineTo(colLeft + segLength, y);
            ctx.stroke();
        }
    }
}

export const metadata = {
    name: 'Scan',
    description: 'Horizontal segments with gap-driven thickness and audio alpha',
    author: 'MP3Player',
    responsive: true,
    optimized: true
};
