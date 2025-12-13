/**
 * PULSE Pattern - Horizontal segments that push each other
 *
 * Inspired by breathing, compression, organic interaction.
 * Multiple horizontal segments per row that grow and push neighbors:
 * - Thickness (height) controlled by bass/mid/treble frequencies
 * - Segments push each other up/down when growing
 * - Perlin noise creates organic variation across columns
 * - Creates breathing, wave-like vertical displacement
 *
 * Design philosophy: Organic interaction, push/pull forces, breathing motion.
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {object} frame - Audio data frame
 * @param {object} noise - Noise generator instance
 */
export function drawPulse(ctx, width, height, frame, noise) {
    const { spectrum, energy, beatPulse, isPlaying } = frame;

    ctx.lineCap = 'butt';

    // Row configuration
    const numRows = 20;
    const rowSpacing = height / numRows;

    // Segments per row
    const segmentWidth = 15;
    const numSegments = Math.ceil(width / segmentWidth);

    for (let row = 0; row < numRows; row++) {
        const baseY = row * rowSpacing + rowSpacing / 2;
        let cumulativeOffset = 0; // Track vertical displacement

        for (let seg = 0; seg < numSegments; seg++) {
            const segT = seg / numSegments;
            const x = seg * segmentWidth;

            // Get frequency values for this segment
            const bassIndex = Math.floor(segT * 8);
            const midIndex = Math.floor(20 + segT * 15);
            const trebleIndex = Math.floor(35 + segT * 15);

            const bassVal = spectrum[bassIndex] || 0;
            const midVal = spectrum[midIndex] || 0;
            const trebleVal = spectrum[trebleIndex] || 0;

            // Perlin noise for organic variation
            const noiseVal = noise.perlin(
                seg * 0.25 + (isPlaying ? frame.time * 0.3 : 0),
                row * 0.2 + (isPlaying ? frame.time * 0.15 : 0)
            );

            // === THICKNESS: Controlled by bass/mid/treble + noise ===
            const baseThickness = 3;
            const thicknessFactor = (bassVal * 0.5 + midVal * 0.3 + trebleVal * 0.2);
            const thickness = isPlaying
                ? (baseThickness + thicknessFactor * 20 + (noiseVal + 1) * 3 + beatPulse * 5)
                : (baseThickness + (noiseVal + 1) * 2);

            // === DISPLACEMENT: Segments push each other ===
            // Direction alternates based on noise and position
            const pushDirection = (noiseVal > 0 ? 1 : -1) * (seg % 2 === 0 ? 1 : -1);
            const displacement = (thickness - baseThickness) * pushDirection * 0.5;

            // Accumulate displacement from previous segments
            cumulativeOffset += displacement;
            const y = baseY + cumulativeOffset;

            // === TRANSPARENCY: Varies with mid/treble ===
            const alpha = isPlaying
                ? (0.6 + midVal * 0.3 + trebleVal * 0.1)
                : 1.0;

            // Draw horizontal segment (stroked line)
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + segmentWidth - 2, y);
            ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, alpha)})`;
            ctx.lineWidth = thickness;
            ctx.stroke();
        }
    }
}

export const metadata = {
    name: 'Pulse',
    description: 'Horizontal segments that push each other with bass-driven growth',
    author: 'MP3Player',
    responsive: true,
    optimized: true
};
