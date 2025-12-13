/**
 * CASCADE Pattern - Vertical segments falling from top
 *
 * Columns of vertical segments anchored at the top, with varying lengths
 * creating a cascading waterfall effect. Dense at top, sparse at bottom.
 * Horizontal and vertical waves create organic variation.
 *
 * Inspired by: 0683829b31d5fde70f4d6c4c59f52699.gif
 *
 * Audio mapping:
 * - Each column maps to a frequency band
 * - Horizontal waves create bands of activity
 * - Vertical waves create traveling pulses
 * - Beat triggers synchronized cascades
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {object} frame - Audio data frame
 * @param {object} noise - Noise generator instance
 */
export function drawCascade(ctx, width, height, frame, noise) {
    const { spectrum, energy, beatPulse, isPlaying } = frame;

    // Grid parameters
    const colSpacing = 8;
    const numCols = Math.ceil(width / colSpacing);
    const baseGap = 14;
    const maxSegments = 30;

    ctx.lineCap = 'butt';

    for (let col = 0; col < numCols; col++) {
        const x = col * colSpacing + colSpacing / 2;
        const colNorm = col / numCols;

        // Frequency for this column
        const freqIndex = Math.floor(colNorm * 50);
        const colFreq = spectrum[freqIndex] || 0;

        // === HORIZONTAL VARIATION ===
        // Each column has a phase offset - creates wave across columns
        const colPhase = noise.perlin(col * 0.08, 0) * Math.PI * 2;

        // Horizontal wave - bands of activity moving across
        const hWave1 = Math.sin(colNorm * Math.PI * 3 + frame.time * 0.2 + colPhase);
        const hWave2 = Math.sin(colNorm * Math.PI * 5 - frame.time * 0.15);
        const horizontalActivity = (hWave1 + hWave2) / 2;  // -1 to 1

        let currentY = 0;

        for (let seg = 0; seg < maxSegments; seg++) {
            const segNorm = seg / maxSegments;
            const yNorm = currentY / height;

            // === VERTICAL VARIATION ===
            // Traveling wave moving down
            const vWaveSpeed = isPlaying ? 0.3 + energy.mid * 0.2 : 0.1;
            const vWave = Math.sin(segNorm * Math.PI * 4 - frame.time * vWaveSpeed + colPhase);

            // Second vertical wave at different frequency
            const vWave2 = Math.sin(segNorm * Math.PI * 2 + frame.time * 0.15 + col * 0.1);

            // Combine for vertical activity
            const verticalActivity = (vWave + vWave2) / 2;

            // === GAP CALCULATION ===
            // Base gap increases toward bottom
            const depthMultiplier = 1 + segNorm * 2;

            // Waves modulate the gap
            const waveGapMod = isPlaying
                ? 1 - (horizontalActivity * 0.3 + verticalActivity * 0.2) - colFreq * 0.3
                : 1 - verticalActivity * 0.2;

            const gap = baseGap * depthMultiplier * Math.max(0.4, waveGapMod);

            // === EXISTENCE CHECK ===
            // Noise determines if segment exists
            const existenceNoise = noise.perlin(
                col * 0.15 + frame.time * 0.08,
                seg * 0.25 + frame.time * 0.05
            );

            // Threshold combines depth, waves, and audio
            const waveBonus = (horizontalActivity + verticalActivity) * 0.25;
            const densityThreshold = isPlaying
                ? segNorm * 0.8 - colFreq * 0.4 - beatPulse * 0.25 - waveBonus
                : segNorm * 0.7 - waveBonus * 0.5;

            if (existenceNoise < densityThreshold) {
                currentY += gap;
                continue;
            }

            // === SEGMENT LENGTH ===
            // Longer at top, modulated by waves
            const baseLength = (1 - segNorm) * 12 + 4;
            const waveLengthMod = (horizontalActivity + 1) / 2;  // 0 to 1

            let segLength;
            if (!isPlaying) {
                segLength = baseLength * (0.7 + waveLengthMod * 0.5);
            } else {
                const freqLength = colFreq * 15;
                const beatLength = beatPulse * 8;
                const waveLength = waveLengthMod * 8;
                segLength = baseLength + freqLength + beatLength + waveLength;
            }
            segLength = Math.max(3, Math.min(22, segLength));

            // === ALPHA ===
            // Brighter where waves converge, brighter at top
            const waveAlpha = (horizontalActivity + verticalActivity + 2) / 4;  // 0 to 1
            const alpha = isPlaying
                ? 0.3 + (1 - segNorm) * 0.2 + colFreq * 0.25 + waveAlpha * 0.2
                : 0.4 + (1 - segNorm) * 0.3 + waveAlpha * 0.2;

            // === THICKNESS ===
            // Each segment responds to frequency based on actual Y position
            // Top = high frequencies, bottom = bass (organized by rows)
            const yNormActual = currentY / height;
            const segFreqIndex = Math.floor((1 - yNormActual) * 50);
            const segFreq = spectrum[segFreqIndex] || 0;

            const thickness = isPlaying
                ? 0.8 + segFreq * 2.5 + waveAlpha * 0.3
                : 1.5;

            ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(0.9, alpha)})`;
            ctx.lineWidth = Math.min(3, thickness);
            ctx.beginPath();
            ctx.moveTo(x, currentY);
            ctx.lineTo(x, currentY + segLength);
            ctx.stroke();

            currentY += segLength + gap;

            if (currentY > height) break;
        }
    }
}

export const metadata = {
    name: 'Cascade',
    description: 'Vertical segments with horizontal and vertical wave variation',
    author: 'MP3Player',
    responsive: true,
    optimized: true
};
