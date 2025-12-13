/**
 * ECHO STRANDS Pattern - Layered horizontal strands with delayed echoes
 *
 * A small stack of flowing horizontal lines; each primary strand has a lighter
 * echo above it. Bass controls amplitude, mids set echo offset and thickness,
 * highs sprinkle tiny tick marks along peaks. All monochrome strokes.
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {object} frame - Audio data frame
 * @param {object} noise - Noise generator instance
 */
export function drawEchoStrands(ctx, width, height, frame, noise) {
    const { spectrum, energy, beatPulse, isPlaying } = frame;
    const quality = frame.qualityMultiplier || 1;

    const baseStrands = 12;
    const strandCount = Math.max(6, Math.floor(baseStrands * quality));
    const xStep = 6;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < strandCount; i++) {
        const t = strandCount <= 1 ? 0 : i / (strandCount - 1);
        const baseY = (0.12 + t * 0.76) * height; // padded top/bottom

        // Map to frequency band (lower strands -> bass)
        const freqIndex = Math.floor((1 - t) * 35);
        const bandVal = spectrum[freqIndex] || 0;

        const amp = isPlaying
            ? (10 + energy.bass * 26 + bandVal * 18 + beatPulse * 8)
            : 7;

        const echoOffset = isPlaying ? (6 + energy.mid * 18) : 4;
        const sideDrift = isPlaying ? noise.perlin(i * 0.3, frame.time * 0.4) * 12 : 0;
        const thickness = isPlaying ? Math.min(4, 1 + t * 2 + bandVal * 2) : 1.4;

        // Main strand
        ctx.beginPath();
        for (let x = 0; x <= width; x += xStep) {
            const xn = x / width;
            const noiseVal = noise.perlin(
                x * 0.003 + frame.time * 0.5,
                i * 0.22 + frame.time * 0.12
            );
            const wave = Math.sin(xn * Math.PI * 2 + frame.time * 0.8 + i * 0.1);
            const y = baseY + (noiseVal * 0.7 + wave * 0.45) * amp;

            if (x === 0) {
                ctx.moveTo(x + sideDrift, y);
            } else {
                ctx.lineTo(x + sideDrift, y);
            }
        }
        ctx.lineWidth = thickness;
        ctx.strokeStyle = `rgba(255, 255, 255, ${isPlaying ? 0.25 + bandVal * 0.6 : 0.9})`;
        ctx.stroke();

        // Two echoes: one above, one slightly below, lighter/thinner
        const echoOffsets = [-echoOffset, echoOffset * 0.4];
        echoOffsets.forEach((eo, idx) => {
            ctx.beginPath();
            for (let x = 0; x <= width; x += xStep) {
                const xn = x / width;
                const noiseVal = noise.perlin(
                    x * 0.003 + frame.time * 0.55 + idx * 5,
                    i * 0.25 + frame.time * 0.14 + idx * 2
                );
                const wave = Math.sin(xn * Math.PI * 2 + frame.time * 0.9 + Math.PI * 0.2 * (idx + 1) + i * 0.08);
                const y = baseY + eo + (noiseVal * 0.5 + wave * 0.35) * amp * 0.6;

                if (x === 0) {
                    ctx.moveTo(x + sideDrift * 0.8, y);
                } else {
                    ctx.lineTo(x + sideDrift * 0.8, y);
                }
            }
            const echoAlpha = isPlaying ? (0.12 + bandVal * 0.35 - idx * 0.02) : 0.55;
            ctx.lineWidth = Math.max(0.7, thickness * (0.5 - idx * 0.1));
            ctx.strokeStyle = `rgba(255, 255, 255, ${echoAlpha})`;
            ctx.stroke();
        });

        // Tick marks on peaks driven by highs, with slight slant and random skip
        if (isPlaying && energy.high > 0.05) {
            for (let x = 0; x <= width; x += xStep * 2) {
                const xn = x / width;
                const wave = Math.sin(xn * Math.PI * 2 + frame.time * 0.8 + i * 0.1);
                const gate = noise.perlin(x * 0.02, i * 0.3 + frame.time * 0.6);
                if (wave > 0.5 + energy.high * 0.2 && gate > -0.2) {
                    const tickY = baseY + wave * amp;
                    const tickLen = 4 + energy.high * 14;
                    const slant = (noise.perlin(x * 0.05, frame.time) - 0.5) * 4;
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 + energy.high * 0.6})`;
                    ctx.beginPath();
                    ctx.moveTo(x + sideDrift + slant, tickY - tickLen);
                    ctx.lineTo(x + sideDrift - slant, tickY + tickLen);
                    ctx.stroke();
                }
            }
        }
    }
}

export const metadata = {
    name: 'Echo Strands',
    description: 'Layered flowing strands with lighter echoes and peak ticks',
    author: 'MP3Player',
    responsive: true,
    optimized: true
};
