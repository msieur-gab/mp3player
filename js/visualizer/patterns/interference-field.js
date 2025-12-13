/**
 * INTERFERENCE FIELD Pattern - Dual angled dash layers creating moiré
 *
 * Two sparse diagonal dash layers at opposite angles. Bass widens spacing and
 * dash length, mids add angle jitter, highs toggle dash visibility to create
 * shimmer. Pure monochrome strokes.
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {object} frame - Audio data frame
 * @param {object} noise - Noise generator instance
 */
export function drawInterferenceField(ctx, width, height, frame, noise) {
    const { energy, beatPulse, isPlaying } = frame;
    const quality = frame.qualityMultiplier || 1;

    const baseSpacing = 18;
    const spacing = baseSpacing / quality;
    const baseDash = 14;

    ctx.lineCap = 'round';

    // Three layers with slowly drifting base angles
    const layers = [
        { angle: Math.PI / 6, speed: 0.4, phase: 0.2 },
        { angle: -Math.PI / 6, speed: 0.35, phase: 0.5 },
        { angle: Math.PI / 3, speed: 0.25, phase: 0.9 }
    ];

    const diagLength = Math.hypot(width, height) * 1.2;
    const lines = Math.floor((width + height) / spacing) + 6;

    layers.forEach((layer, idx) => {
        // Slowly rotate base angle for organic variation
        const baseAngle = layer.angle + Math.sin(frame.time * 0.1 + layer.phase) * 0.08;
        const cosA = Math.cos(baseAngle);
        const sinA = Math.sin(baseAngle);

        for (let i = -3; i < lines + 3; i++) {
            // Offset centered to fill canvas
            const offset = (i - lines / 2) * spacing;

            // Angle jitter from mids + noise
            const jitter = isPlaying ? (energy.mid * 0.1) : 0;
            const jitterAngle = baseAngle + jitter * noise.perlin(i * 0.12, frame.time * 0.35 + idx);
            const jCos = Math.cos(jitterAngle);
            const jSin = Math.sin(jitterAngle);

            // Dash length/spacing with bass and beat
            const dashLen = isPlaying
                ? (baseDash + energy.bass * 16 + beatPulse * 8)
                : baseDash * 0.7;
            const gap = dashLen * (isPlaying ? (0.5 + energy.mid * 0.3) : 0.7);
            const totalStep = dashLen + gap;

            // Highs gate some dashes, but softer to avoid emptiness
            const gate = noise.perlin(i * 0.22 + idx, frame.time * 0.9);
            const gated = isPlaying && gate > 0.7 + energy.high * 0.25;

            // Start position along perpendicular direction, centered
            const start = centerX(width, height, offset, cosA, sinA);

            let traveled = -diagLength * 0.1; // start before canvas to ensure coverage
            while (traveled < diagLength) {
                if (!gated) {
                    const x1 = start.x + jCos * traveled;
                    const y1 = start.y + jSin * traveled;
                    const x2 = start.x + jCos * (traveled + dashLen);
                    const y2 = start.y + jSin * (traveled + dashLen);

                    const alpha = isPlaying
                        ? Math.min(1, 0.18 + energy.overall * 0.55 + beatPulse * 0.35)
                        : 0.35;
                    const thickness = isPlaying ? Math.min(3.2, 1 + energy.bass * 1.4) : 1;

                    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
                    ctx.lineWidth = thickness;
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                }

                traveled += totalStep;
            }
        }
    });
}

// Helper to find a starting point offset along the perpendicular direction
function centerX(width, height, offset, cosA, sinA) {
    // Perpendicular vector (-sin, cos)
    const px = -sinA * offset;
    const py = cosA * offset;
    // Centered at canvas midpoint
    return { x: width / 2 + px, y: height / 2 + py };
}

export const metadata = {
    name: 'Interference Field',
    description: 'Dual angled dash layers forming a monochrome moiré',
    author: 'MP3Player',
    responsive: true,
    optimized: true
};
