/**
 * RIBBON ORBIT Pattern - Concentric segmented arcs with subtle wobble
 *
 * Monochrome rings made of short line segments. Bass swells radius and thickness,
 * mids wobble the arc positions, highs throw tiny outward flares on select segments,
 * and beat pulse adds a gentle inhale/exhale.
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {object} frame - Audio data frame
 * @param {object} noise - Noise generator instance
 */
export function drawRibbonOrbit(ctx, width, height, frame, noise) {
    const { energy, beatPulse, isPlaying } = frame;
    const quality = frame.qualityMultiplier || 1;

    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) * 0.48;

    // Fewer rings on low quality to keep perf stable
    const baseRings = 8;
    const ringCount = Math.max(4, Math.floor(baseRings * quality));

    // Arc segmentation
    const baseSegments = 96;
    const segments = Math.max(32, Math.floor(baseSegments * quality));
    const angleStep = (Math.PI * 2) / segments;

    ctx.lineCap = 'round';

    for (let r = 0; r < ringCount; r++) {
        const t = ringCount <= 1 ? 0 : r / (ringCount - 1);
        const baseRadius = 24 + t * maxRadius;

        // Bass swells radius; beat adds breathing; mids add wobble and slow rotation
        const swell = isPlaying ? (1 + energy.bass * 0.4 + beatPulse * 0.2) : 1;
        const wobbleAmp = isPlaying ? (5 + energy.mid * 14) : 3;
        const radius = baseRadius * swell;

        // Line thickness
        const thickness = isPlaying ? Math.min(3.6, 1 + t * 2 + energy.bass * 1.2) : 1.4;

        // Slow ring rotation for moiré feel
        const ringPhase = frame.time * (0.12 + energy.mid * 0.25) + r * 0.35;

        for (let s = 0; s < segments; s++) {
            const a1 = s * angleStep + ringPhase;
            const a2 = a1 + angleStep * 0.82; // leave tiny gap for segmentation look

            // Perlin wobble along angle to create petal-like offsets
            const wobble = noise.perlin(a1 * 0.6, frame.time * 0.3 + r * 0.2) * wobbleAmp;
            const radialNoise = noise.perlin(r * 0.3, s * 0.05 + frame.time * 0.4) * 4;

            const rad1 = radius + wobble + radialNoise;
            const rad2 = radius + wobble + radialNoise;

            // Moiré: skip some segments based on a slow-moving mask
            const mask = noise.perlin(s * 0.08 + r * 0.15, frame.time * 0.2);
            if (isPlaying && mask > 0.72 - energy.high * 0.3) {
                continue;
            }

            const x1 = centerX + Math.cos(a1) * rad1;
            const y1 = centerY + Math.sin(a1) * rad1;
            const x2 = centerX + Math.cos(a2) * rad2;
            const y2 = centerY + Math.sin(a2) * rad2;

            // Alpha falls off slightly toward outer rings
            const alpha = isPlaying
                ? Math.min(1, 0.18 + energy.overall * 0.45 + (1 - t) * 0.35)
                : 0.65;

            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.lineWidth = thickness;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            // Light double-stroke offset for halo shimmer
            const offsetRad = 2 + energy.mid * 4;
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.4})`;
            ctx.lineWidth = Math.max(0.7, thickness * 0.5);
            ctx.beginPath();
            ctx.moveTo(
                centerX + Math.cos(a1) * (rad1 + offsetRad),
                centerY + Math.sin(a1) * (rad1 + offsetRad)
            );
            ctx.lineTo(
                centerX + Math.cos(a2) * (rad2 + offsetRad),
                centerY + Math.sin(a2) * (rad2 + offsetRad)
            );
            ctx.stroke();

            // Highs throw small outward flares on a few segments (still monochrome)
            if (isPlaying) {
                const highVal = energy.high;
                const sparkSeed = noise.perlin(r * 0.2, frame.time * 0.9 + s * 0.06);
                if (sparkSeed > 0.6 + highVal * 0.35) {
                    const flareLen = 3 + highVal * 12 + beatPulse * 5;
                    const flareX1 = centerX + Math.cos(a2) * (rad2 + 1);
                    const flareY1 = centerY + Math.sin(a2) * (rad2 + 1);
                    const flareX2 = centerX + Math.cos(a2) * (rad2 + flareLen);
                    const flareY2 = centerY + Math.sin(a2) * (rad2 + flareLen);

                    ctx.lineWidth = 1.1;
                    ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, 0.25 + highVal * 0.75)})`;
                    ctx.beginPath();
                    ctx.moveTo(flareX1, flareY1);
                    ctx.lineTo(flareX2, flareY2);
                    ctx.stroke();
                }
            }
        }
    }
}

export const metadata = {
    name: 'Ribbon Orbit',
    description: 'Concentric segmented arcs that swell and wobble with audio',
    author: 'MP3Player',
    responsive: true,
    optimized: true
};
