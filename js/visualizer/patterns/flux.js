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
    const numLines = 60; // Dense field of lines
    const { spectrum, energy, beatPulse, isPlaying } = frame;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Base angle for parallel lines (diagonal)
    const baseAngle = Math.PI / 6; // 30 degrees

    // Very gentle flow
    const flowSpeed = isPlaying ? energy.mid * 0.2 : 0;

    for (let i = 0; i < numLines; i++) {
        const t = i / numLines;

        // Lines are evenly spaced diagonally across canvas
        const spacing = (width + height) / numLines;
        const startOffset = i * spacing;

        ctx.beginPath();

        // Draw line from one edge to another
        const lineLength = Math.hypot(width, height) * 1.5;
        const numPoints = 100;

        for (let p = 0; p <= numPoints; p++) {
            const progress = p / numPoints;
            const dist = progress * lineLength;

            // Base position along diagonal
            let x = -height + startOffset + Math.cos(baseAngle) * dist;
            let y = Math.sin(baseAngle) * dist;

            // Create traveling waves using spectrum
            let waveOffset = 0;

            // 2-3 gentle waves traveling through the field
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
            const amp = isPlaying ? 12 + energy.bass * 18 : 8;
            const totalOffset = (noiseVal * 0.5 + waveOffset * 0.5 + beatPulse * 0.2) * amp;

            // Apply offset perpendicular to line direction
            const perpAngle = baseAngle + Math.PI / 2;
            x += Math.cos(perpAngle) * totalOffset;
            y += Math.sin(perpAngle) * totalOffset;

            // Clip to canvas bounds
            if (x < -100 || x > width + 100 || y < -100 || y > height + 100) {
                continue;
            }

            if (p === 0 || (x >= 0 && x <= width && y >= 0 && y <= height)) {
                if (ctx.currentPath === undefined || p === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
        }

        // Delicate line style - fade toward edges
        if (!isPlaying) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 1.0)';
            ctx.lineWidth = 0.7;
        } else {
            // Very subtle opacity variation
            const centerDist = Math.abs(t - 0.5) * 2; // 0 at center, 1 at edges
            const alpha = 0.15 + (0.25 * (1 - centerDist)) + (energy.bass * 0.15);
            ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(0.6, alpha)})`;
            ctx.lineWidth = 0.5 + (energy.bass * 0.4);
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
