/**
 * PULSE SCAN Pattern - Vertical scan lines bending around pressure knots
 *
 * Vertical columns made of short line segments. Bass raises curvature around
 * moving knots, mids increase scan speed, highs add transient ticks. Minimal,
 * monochrome strokes with plenty of negative space.
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {object} frame - Audio data frame
 * @param {object} noise - Noise generator instance
 */
export function drawPulseScan(ctx, width, height, frame, noise) {
    const { spectrum, energy, beatPulse, isPlaying } = frame;
    const quality = frame.qualityMultiplier || 1;

    const baseSpacing = 14;
    const spacing = baseSpacing / quality;
    const cols = Math.floor(width / spacing);
    const segLen = 8;

    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';

    // Three moving knots; beat grows their reach
    const knotCount = 3;
    const knots = [];
    for (let k = 0; k < knotCount; k++) {
        const phase = frame.time * (0.45 + k * 0.12);
        const kx = (0.15 + 0.35 * k + 0.08 * Math.sin(phase * 0.6)) * width;
        const ky = (0.25 + 0.5 * Math.abs(Math.sin(phase + k))) * height;
        const reach = 20 + energy.bass * 80 + beatPulse * 40;
        knots.push({ x: kx, y: ky, reach });
    }

    for (let i = 0; i <= cols; i++) {
        const xBase = i * spacing;
        const colT = i / Math.max(1, cols);
        const freqIndex = Math.floor(colT * 40);
        const colEnergy = spectrum[freqIndex] || 0;

        // Column-specific scan drift and jitter
        const colPhase = noise.perlin(i * 0.08, frame.time * 0.25) * Math.PI * 2;
        const scanOffset = isPlaying ? (frame.time * (0.8 + energy.mid * 1.2) + colPhase * 0.2) : 0;

        for (let y = 0; y < height; y += segLen) {
            const yMid = y + segLen * 0.5;

            // Curvature influenced by knots (stronger on bass)
            let bend = 0;
            knots.forEach((knot, idx) => {
                const dy = yMid - (knot.y + Math.sin(scanOffset * 0.35 + idx) * 20);
                const dx = xBase - knot.x;
                const dist = Math.hypot(dx, dy) + 1;
                const influence = (energy.bass * 0.9 + 0.2) * Math.exp(-dist / (knot.reach + 1));
                bend += (dx / dist) * influence * 22;
            });

            // Add a subtle waving drift so lines feel alive; more jitter on highs
            const drift = noise.perlin(i * 0.15, y * 0.05 + scanOffset * 0.5) * (isPlaying ? 4 : 2);
            const jitter = isPlaying ? noise.perlin(i * 0.4, y * 0.4 + frame.time * 1.5) * energy.high * 6 : 0;

            const x = xBase + bend + drift + jitter;
            const length = isPlaying
                ? (segLen + colEnergy * 6 + beatPulse * 3)
                : segLen;

            const thickness = isPlaying ? Math.min(3, 1 + colEnergy * 2) : 1.2;
            const alpha = isPlaying ? 0.25 + colEnergy * 0.6 : 0.8;

            ctx.lineWidth = thickness;
            ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, alpha)})`;
            ctx.beginPath();
            ctx.moveTo(x, yMid - length / 2);
            ctx.lineTo(x, yMid + length / 2);
            ctx.stroke();

            // High-frequency ticks at random-ish positions, with occasional diagonal slant
            if (isPlaying && energy.high > 0.05) {
                const gate = noise.perlin(i * 0.3, y * 0.2 + scanOffset);
                if (gate > 0.55 + energy.high * 0.3) {
                    const tickLen = 3 + energy.high * 10;
                    const slant = (noise.perlin(i * 0.5, y * 0.5 + frame.time) - 0.5) * energy.high * 6;
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 + energy.high * 0.7})`;
                    ctx.beginPath();
                    ctx.moveTo(x - tickLen * 0.6 + slant, yMid - slant);
                    ctx.lineTo(x + tickLen * 0.6 + slant, yMid + slant);
                    ctx.stroke();
                }
            }
        }
    }
}

export const metadata = {
    name: 'Pulse Scan',
    description: 'Vertical scan lines bending around moving pressure knots',
    author: 'MP3Player',
    responsive: true,
    optimized: true
};
