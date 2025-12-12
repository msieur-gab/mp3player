/**
 * BREATH Pattern - Grid of rotating dashes
 *
 * An organic, flowing pattern where dashes rotate smoothly based on noise and audio.
 * Creates a breathing, meditative effect with audio-reactive rotation and thickness.
 *
 * Audio mapping:
 * - Vertical position determines frequency band (lower = bass, higher = treble)
 * - Mid frequencies control rotation amount
 * - Beat pulse adds thickness variations
 * - Overall audio intensity affects transparency
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {object} frame - Audio data frame
 * @param {object} noise - Noise generator instance
 */
export function drawBreath(ctx, width, height, frame, noise) {
    // OPTIMIZATION 4: Reduce grid density on mobile
    const baseGridSpacing = 25;
    const gridSpacing = baseGridSpacing / (frame.qualityMultiplier || 1);
    const dashLength = 15;
    const { spectrum, energy, beatPulse, isPlaying } = frame;
    ctx.lineCap = 'round';

    for (let y = gridSpacing; y < height; y += gridSpacing) {
        const t = y / height;
        const normY = 1 - t;
        const audioIndex = Math.floor(normY * 40);
        const audioVal = spectrum[audioIndex] || 0;

        for (let x = gridSpacing; x < width; x += gridSpacing) {
            const noiseVal = noise.perlin(
                x * 0.005 + frame.time * 0.2,
                y * 0.005 + frame.time * 0.2
            );
            const baseAngle = noiseVal * Math.PI * 4;
            const audioRotation = audioVal * energy.mid * Math.PI;
            const angle = baseAngle + audioRotation;

            let thickness;
            if (!isPlaying) {
                thickness = 1.5;
            } else {
                thickness = 0.5 + (t * 0.5) + (audioVal * 2.5) + (beatPulse * 0.5);
                thickness = Math.min(4.0, thickness);
            }

            const currentLength = dashLength;
            const halfLength = currentLength / 2;
            const x1 = x - Math.cos(angle) * halfLength;
            const y1 = y - Math.sin(angle) * halfLength;
            const x2 = x + Math.cos(angle) * halfLength;
            const y2 = y + Math.sin(angle) * halfLength;

            const alpha = !isPlaying ? 0.4 : (0.15 + audioVal * 0.85);

            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.lineWidth = thickness;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
    }
}

export const metadata = {
    name: 'Breath',
    description: 'Organic rotating dashes creating a breathing, meditative flow',
    author: 'MP3Player',
    responsive: true,
    optimized: true
};
