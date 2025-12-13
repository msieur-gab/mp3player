/**
 * RAIN Pattern - Vertical falling lines
 *
 * Columns of vertical segments that fall like rain, with dynamic audio response.
 * Bass creates heavier drops, mids control density waves, highs add shimmer.
 *
 * Audio mapping:
 * - Bass: Drop thickness and intensity bursts
 * - Mids: Horizontal drift and density waves
 * - Highs: Sparkle effects and tip brightness
 * - Beat: Synchronized downpour bursts
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {object} frame - Audio data frame
 * @param {object} noise - Noise generator instance
 */
export function drawRain(ctx, width, height, frame, noise) {
    const baseSpacing = 10;
    const spacing = baseSpacing / (frame.qualityMultiplier || 1);
    const cols = Math.ceil(width / spacing);
    const { spectrum, energy, beatPulse, isPlaying } = frame;

    ctx.lineCap = 'round';

    // Global modulations from audio
    const bassIntensity = isPlaying ? energy.bass : 0;
    const midWave = isPlaying ? energy.mid : 0;
    const highSparkle = isPlaying ? energy.high : 0;

    for (let col = 0; col < cols; col++) {
        const baseX = col * spacing + spacing / 2;
        const colNorm = col / cols;

        // Frequency for this column position
        const freqIndex = Math.floor(colNorm * 50);
        const colAudio = spectrum[freqIndex] || 0;

        // Mid-frequency creates horizontal density waves
        const densityWave = Math.sin(colNorm * Math.PI * 4 + frame.time * 0.5 * (1 + midWave));
        const localDensity = 0.5 + densityWave * 0.3 + midWave * 0.3;

        // Number of drops varies with audio and density wave
        const baseDrops = isPlaying ? 3 : 2;
        const audioDrops = isPlaying ? Math.floor(colAudio * 3 + beatPulse * 4) : 0;
        const numDrops = Math.floor((baseDrops + audioDrops) * localDensity);

        for (let d = 0; d < numDrops; d++) {
            // Each drop has unique phase
            const dropSeed = noise.perlin(col * 0.2 + d * 50, d * 0.3);
            const dropPhase = (dropSeed + 1) / 2;

            // SLOWED DOWN: Fall speed much gentler
            const bassFallBoost = bassIntensity * 0.1;
            const fallSpeed = isPlaying
                ? 0.04 + dropPhase * 0.06 + bassFallBoost + beatPulse * 0.05
                : 0.02 + dropPhase * 0.03;

            // Stagger drops in time
            const timeOffset = dropPhase * 5 + d * 2.3 + col * 0.1;
            const yProgress = ((frame.time * fallSpeed + timeOffset) % 1.3) - 0.15;
            const y = yProgress * height;

            // Horizontal drift from mids (wind effect) - more subtle
            const windDrift = isPlaying
                ? Math.sin(frame.time * 0.4 + col * 0.1) * midWave * 8
                : 0;
            const x = baseX + windDrift;

            // Drop length - bass makes heavier drops
            let dropLength;
            if (!isPlaying) {
                dropLength = 12 + dropPhase * 25;
            } else {
                const bassLength = bassIntensity * 30;
                const audioLength = colAudio * 25;
                const beatLength = beatPulse * 15;
                dropLength = 8 + bassLength + audioLength + beatLength + dropPhase * 15;
            }
            dropLength = Math.min(dropLength, 70);

            // Fade based on position
            const fadeIn = Math.min(1, yProgress * 6);
            const fadeOut = Math.min(1, (1.15 - yProgress) * 4);
            const baseFade = fadeIn * fadeOut;

            // Alpha - highs add sparkle variation
            let alpha;
            if (!isPlaying) {
                alpha = baseFade * 0.6;
            } else {
                const sparkleVar = highSparkle * (Math.random() * 0.3);
                alpha = baseFade * (0.25 + colAudio * 0.4 + bassIntensity * 0.2 + sparkleVar);
            }

            // Thickness - bass makes thicker drops
            const thickness = !isPlaying
                ? 1.2
                : Math.min(2.5, 0.8 + bassIntensity * 1.2 + colAudio * 0.8 + beatPulse * 0.5);

            // Draw if visible
            if (alpha > 0.05 && y > -dropLength && y < height + 10) {
                ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(0.85, alpha)})`;
                ctx.lineWidth = thickness;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x - windDrift * 0.2, y + dropLength);
                ctx.stroke();

                // High frequency sparkle at drop tips - less frequent
                if (isPlaying && highSparkle > 0.5 && Math.random() < highSparkle * 0.15) {
                    const sparkleAlpha = alpha * highSparkle;
                    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.7, sparkleAlpha)})`;
                    ctx.beginPath();
                    ctx.arc(x - windDrift * 0.2, y + dropLength, thickness * 0.6, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }
}

export const metadata = {
    name: 'Rain',
    description: 'Gentle falling lines with bass-driven intensity',
    author: 'MP3Player',
    responsive: true,
    optimized: true
};
