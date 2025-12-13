/**
 * WEAVE Pattern - Diagonal dash interference
 *
 * Grid of dashes at systematic angles creating moiré/wave interference patterns.
 * The dashes rotate in waves across the surface, creating rippling visual effects.
 *
 * Audio mapping:
 * - Wave phase shifts with overall energy
 * - Wave amplitude responds to bass
 * - Rotation intensity tied to mids
 * - Beat pulse creates ripple bursts
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {object} frame - Audio data frame
 * @param {object} noise - Noise generator instance
 */
export function drawWeave(ctx, width, height, frame, noise) {
    const baseSpacing = 20;
    const spacing = baseSpacing / (frame.qualityMultiplier || 1);
    const dashLength = 14;
    const { spectrum, energy, beatPulse, isPlaying } = frame;

    ctx.lineCap = 'round';

    const centerX = width / 2;
    const centerY = height / 2;
    const maxDist = Math.hypot(centerX, centerY);

    for (let y = spacing / 2; y < height; y += spacing) {
        const rowNorm = y / height;
        const freqIndex = Math.floor((1 - rowNorm) * 40);
        const rowAudio = spectrum[freqIndex] || 0;

        for (let x = spacing / 2; x < width; x += spacing) {
            const colNorm = x / width;

            // Distance from center for radial effects
            const dx = x - centerX;
            const dy = y - centerY;
            const dist = Math.hypot(dx, dy);
            const normDist = dist / maxDist;

            // Create wave pattern across the grid
            // Multiple overlapping waves for interference
            const wave1 = Math.sin(x * 0.05 + frame.time * 0.5);
            const wave2 = Math.sin(y * 0.05 + frame.time * 0.3);
            const wave3 = Math.sin((x + y) * 0.03 + frame.time * 0.4);

            // Radial wave from center (expands on beat)
            const radialWave = Math.sin(dist * 0.05 - frame.time * 0.8 - beatPulse * 2);

            // Combine waves
            let waveSum;
            if (!isPlaying) {
                waveSum = (wave1 + wave2 + wave3) / 3;
            } else {
                const audioMod = rowAudio + energy.bass * 0.5;
                waveSum = (wave1 * (1 + audioMod) + wave2 + wave3 + radialWave * energy.mid) / 4;
            }

            // Base angle from wave interference
            const baseAngle = Math.PI / 4; // 45 degrees base
            const waveRotation = waveSum * Math.PI * 0.5;

            // Audio-reactive rotation boost
            const audioRotation = isPlaying
                ? rowAudio * energy.mid * Math.PI * 0.3
                : 0;

            const angle = baseAngle + waveRotation + audioRotation;

            // Calculate dash endpoints
            const halfLen = dashLength / 2;
            const x1 = x - Math.cos(angle) * halfLen;
            const y1 = y - Math.sin(angle) * halfLen;
            const x2 = x + Math.cos(angle) * halfLen;
            const y2 = y + Math.sin(angle) * halfLen;

            // Alpha based on wave position and audio
            const waveAlpha = (waveSum + 1) / 2; // Normalize to 0-1
            const alpha = !isPlaying
                ? 0.5 + waveAlpha * 0.4
                : 0.2 + waveAlpha * 0.4 + rowAudio * 0.5;

            // Thickness
            const thickness = !isPlaying
                ? 1.5
                : Math.min(3.5, 1 + rowAudio * 2 + beatPulse * 0.8);

            ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, alpha)})`;
            ctx.lineWidth = thickness;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
    }
}

export const metadata = {
    name: 'Weave',
    description: 'Diagonal dashes creating wave interference patterns',
    author: 'MP3Player',
    responsive: true,
    optimized: true
};
