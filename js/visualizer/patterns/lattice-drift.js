/**
 * LATTICE DRIFT Pattern - Sparse grid pulled by drifting focal points
 *
 * Minimal monochrome lattice where intersections are gently displaced toward
 * a few moving focal points. Bass strengthens pull, mids shear columns, highs
 * punch holes by skipping segments.
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {object} frame - Audio data frame
 * @param {object} noise - Noise generator instance
 */
export function drawLatticeDrift(ctx, width, height, frame, noise) {
    const { energy, beatPulse, isPlaying } = frame;
    const quality = frame.qualityMultiplier || 1;

    // Sparse grid
    const baseStep = 70;
    const step = baseStep / quality;
    const cols = Math.floor(width / step) + 2;
    const rows = Math.floor(height / step) + 2;

    // Center grid inside canvas
    const gridOffsetX = (width - cols * step) / 2;
    const gridOffsetY = (height - rows * step) / 2;

    // Animated focal points (deterministic positions)
    const focalCount = 2;
    const focalPoints = [];
    for (let i = 0; i < focalCount; i++) {
        const phase = frame.time * 0.12 + i * Math.PI * 0.75;
        const fx = (0.3 + 0.4 * Math.sin(phase)) * width;
        const fy = (0.3 + 0.4 * Math.cos(phase * 0.9)) * height;
        focalPoints.push({ x: fx, y: fy });
    }

    // Precompute node positions with displacement
    const nodes = [];
    for (let r = 0; r <= rows; r++) {
        const row = [];
        for (let c = 0; c <= cols; c++) {
            const baseX = c * step + gridOffsetX;
            const baseY = r * step + gridOffsetY;

            // Pull toward focal points based on bass energy
            let dxAccum = 0;
            let dyAccum = 0;
            focalPoints.forEach(fp => {
                const dx = fp.x - baseX;
                const dy = fp.y - baseY;
                const dist = Math.hypot(dx, dy) + 1;
                const influence = (energy.bass * 0.75 + 0.12) * (1 / dist) * 140;
                dxAccum += dx / dist * influence;
                dyAccum += dy / dist * influence;
            });

            // Shear from mids
            const shear = isPlaying ? (energy.mid * 0.2) : 0;
            dxAccum += (r - rows / 2) * step * shear * 0.3;

            // Gentle noise jitter so it feels alive (more with highs)
            const jitter = isPlaying ? 2 + beatPulse * 4 + energy.high * 3 : 1;
            dxAccum += noise.perlin(baseX * 0.01, baseY * 0.01 + frame.time * 0.3) * jitter;
            dyAccum += noise.perlin(baseX * 0.01 + 50, baseY * 0.01 + frame.time * 0.25) * jitter;

            row.push({ x: baseX + dxAccum, y: baseY + dyAccum });
        }
        nodes.push(row);
    }

    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';

    // Draw horizontal and vertical segments; highs punch occasional gaps
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const n00 = nodes[r][c];
            const n10 = nodes[r][c + 1];
            const n01 = nodes[r + 1][c];

            // High-frequency gating to remove some segments
            const gate = noise.perlin(r * 0.2, c * 0.2 + frame.time * 0.6);
            const skip = isPlaying && gate > 0.6 + energy.high * 0.3;

            if (!skip) {
                ctx.lineWidth = isPlaying ? Math.min(3.2, 1 + energy.bass * 1.6 + beatPulse * 0.6 + energy.mid * 0.6) : 1.2;

                // Horizontal
                ctx.beginPath();
                ctx.moveTo(n00.x, n00.y);
                ctx.lineTo(n10.x, n10.y);
                ctx.stroke();

                // Vertical
                ctx.beginPath();
                ctx.moveTo(n00.x, n00.y);
                ctx.lineTo(n01.x, n01.y);
                ctx.stroke();
            }

            // Small intersection sparkles on highs
            if (isPlaying && energy.high > 0.08) {
                const sparkleGate = noise.perlin(c * 0.35, r * 0.35 + frame.time * 1.2);
                if (sparkleGate > 0.5 + energy.high * 0.2) {
                    const size = 2 + energy.high * 4;
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 + energy.high * 0.5})`;
                    ctx.beginPath();
                    ctx.moveTo(n00.x - size, n00.y);
                    ctx.lineTo(n00.x + size, n00.y);
                    ctx.moveTo(n00.x, n00.y - size);
                    ctx.lineTo(n00.x, n00.y + size);
                    ctx.stroke();
                }
            }
        }
    }
}

export const metadata = {
    name: 'Lattice Drift',
    description: 'Sparse monochrome grid pulled by drifting focal points',
    author: 'MP3Player',
    responsive: true,
    optimized: true
};
