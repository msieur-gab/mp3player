/**
 * NEEDLES Pattern - Grid of dots that shoot lines outward
 *
 * A radial pattern where needles extend from grid points based on audio intensity.
 * The needles rotate and pulse with the music, creating a dynamic spiky field.
 *
 * Audio mapping:
 * - Distance from center determines which frequency band affects each needle
 * - Bass creates pulsing expansion
 * - Mids control the twist/rotation amount
 * - Highs modulate needle deflection angles
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {object} frame - Audio data frame
 * @param {object} noise - Noise generator instance
 */
export function drawNeedles(ctx, width, height, frame, noise) {
    // OPTIMIZATION 4: Reduce grid density on mobile (30 -> 60 spacing = 75% fewer entities)
    const baseGridStep = 30;
    const gridStep = baseGridStep / (frame.qualityMultiplier || 1);

    const centerX = width / 2;
    const centerY = height / 2;
    const maxDist = Math.hypot(centerX, centerY);
    const { spectrum, energy, beatPulse, isPlaying } = frame;

    const twistAmount = energy.mid * 1.5;
    ctx.lineCap = 'round';

    for (let x = gridStep / 2; x < width; x += gridStep) {
        for (let y = gridStep / 2; y < height; y += gridStep) {
            const dx = x - centerX;
            const dy = y - centerY;
            const distFromCenter = Math.hypot(dx, dy);
            const normDist = distFromCenter / maxDist;

            const freqIndex = Math.floor(normDist * 50);
            const audioVal = spectrum[freqIndex] || 0;

            // 1. ROOT DOTS
            const currentSize = 1.5;
            const dotAlpha = 0.4 + (0.6 * (1 - normDist));

            ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, dotAlpha)})`;
            ctx.beginPath();
            ctx.arc(x, y, currentSize, 0, Math.PI * 2);
            ctx.fill();

            // 2. NEEDLES
            const baseAngle = Math.atan2(dy, dx);
            const noiseAngle = noise.perlin(x * 0.005, y * 0.005 + frame.time * 0.3);

            const audioDeflection = (audioVal * Math.PI * 0.8) * (energy.high + 0.5);
            const angle = baseAngle + (noiseAngle * 0.5) + (twistAmount * normDist * 0.2) + audioDeflection;

            const idleLen = 3 + (noiseAngle * 2);
            const activeLen = (audioVal * 60) + (beatPulse * 30 * normDist);
            const length = Math.min(idleLen + activeLen, gridStep * 0.9);

            const tipX = x + Math.cos(angle) * length;
            const tipY = y + Math.sin(angle) * length;

            const lineAlpha = 0.2 + (audioVal * 0.8);

            let thickness;
            if (!isPlaying) {
                thickness = 1.5;
            } else {
                thickness = 0.5 + (audioVal * 3.5);
                thickness = Math.min(4.0, thickness);
            }

            if (length > 2.0) {
                ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, lineAlpha)})`;
                ctx.lineWidth = thickness;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(tipX, tipY);
                ctx.stroke();
            }
        }
    }
}

export const metadata = {
    name: 'Needles',
    description: 'Grid of dots shooting lines outward, pulsing with audio',
    author: 'MP3Player',
    responsive: true,
    optimized: true
};
