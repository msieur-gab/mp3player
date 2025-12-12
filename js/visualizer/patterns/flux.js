/**
 * FLUX Pattern - Dense field of flowing parallel lines
 *
 * Inspired by flowing fabric or field lines creating depth through collective movement.
 * Many parallel lines curve and flow together, creating gentle waves across the canvas.
 * Subtle, meditative quality - like watching wind move through tall grass.
 *
 * Design philosophy: Collective gentleness - beauty through synchronized subtlety.
 *
 * Audio mapping:
 * - Bass creates traveling waves through the field
 * - Mid energy controls flow direction and speed
 * - Treble adds delicate ripples
 * - All lines move together creating unified flow
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {object} frame - Audio data frame
 * @param {object} noise - Noise generator instance
 */
export function drawFlux(ctx, width, height, frame, noise) {
    const numLines = 50; // Dense field of lines
    const { spectrum, energy, beatPulse, isPlaying } = frame;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Very gentle flow
    const flowSpeed = isPlaying ? energy.mid * 0.2 : 0;

    // Draw diagonal lines from top-left to bottom-right
    const spacing = 15; // Space between parallel lines
    const totalLines = Math.ceil((width + height) / spacing);

    for (let i = 0; i < totalLines; i++) {
        const t = i / totalLines;

        ctx.beginPath();

        // Each line starts from either top or left edge
        let startX, startY, endX, endY;

        if (i * spacing < width) {
            // Start from top edge
            startX = i * spacing;
            startY = 0;
            endX = 0;
            endY = i * spacing;
        } else {
            // Start from right edge
            startX = width;
            startY = (i * spacing) - width;
            endX = width - ((i * spacing) - width);
            endY = height;
        }

        // Draw curved line from start to end
        const numSegments = 50;

        for (let s = 0; s <= numSegments; s++) {
            const progress = s / numSegments;

            // Interpolate between start and end
            const baseX = startX + (endX - startX) * progress;
            const baseY = startY + (endY - startY) * progress;

            // Create traveling waves using spectrum
            let waveOffset = 0;
            const numWaves = 2;

            for (let w = 0; w < numWaves; w++) {
                const freqIndex = Math.floor(w * 12);
                const freqVal = spectrum[freqIndex] || 0;

                // Wave position moves along the line
                const wavePos = ((frame.time * (0.04 + w * 0.02) + w * 0.4) % 1);
                const distFromWave = Math.abs(progress - wavePos);

                // Very smooth wave influence
                const influence = Math.exp(-distFromWave * distFromWave * 10);
                waveOffset += freqVal * influence;
            }

            // Perlin noise for organic movement
            const noiseVal = noise.perlin(
                progress * 2 + frame.time * (0.05 + flowSpeed * 0.1),
                i * 0.1 + frame.time * 0.03
            );

            // Combine influences - very subtle
            const amp = isPlaying ? 10 + energy.bass * 15 : 6;
            const totalOffset = (noiseVal * 0.5 + waveOffset * 0.5 + beatPulse * 0.2) * amp;

            // Offset perpendicular to line (diagonal)
            const perpX = -totalOffset * 0.707; // cos(45°)
            const perpY = totalOffset * 0.707;  // sin(45°)

            const x = baseX + perpX;
            const y = baseY + perpY;

            if (s === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        // Delicate line style - fade toward edges
        if (!isPlaying) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 1.0)';
            ctx.lineWidth = 0.7;
        } else {
            // Very subtle opacity variation
            const centerDist = Math.abs(t - 0.5) * 2; // 0 at center, 1 at edges
            const alpha = 0.2 + (0.3 * (1 - centerDist)) + (energy.bass * 0.15);
            ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(0.7, alpha)})`;
            ctx.lineWidth = 0.6 + (energy.bass * 0.4);
        }

        ctx.stroke();
    }
}

export const metadata = {
    name: 'Flux',
    description: 'Dense field of parallel lines flowing like fabric in wind',
    author: 'MP3Player',
    responsive: true,
    optimized: true
};
