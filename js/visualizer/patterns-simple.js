/**
 * Simplified Visualizer Patterns
 *
 * Key changes from original:
 * - Each pattern draws a COMPLETE frame (not incremental)
 * - No reliance on fade effects
 * - Simpler calculations
 * - Cleaner, more readable code
 */

/**
 * Needles - Grid of audio-reactive needles
 */
export function drawNeedles(ctx, width, height, audio, noise) {
    const gridSize = 30;
    const cols = Math.floor(width / gridSize);
    const rows = Math.floor(height / gridSize);

    ctx.strokeStyle = '#fff';
    ctx.fillStyle = '#fff';
    ctx.lineWidth = 1;

    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            const x = i * gridSize + gridSize / 2;
            const y = j * gridSize + gridSize / 2;

            // Get audio value for this position
            const index = Math.floor((i / cols) * audio.spectrum.length);
            const value = audio.spectrum[index] || 0;

            // Draw dot
            ctx.beginPath();
            ctx.arc(x, y, 1, 0, Math.PI * 2);
            ctx.fill();

            // Draw needle based on audio
            if (value > 0.1) {
                const angle = noise.simplex2(i * 0.1, j * 0.1 + audio.time * 0.5);
                const length = value * gridSize * 0.8;

                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(
                    x + Math.cos(angle) * length,
                    y + Math.sin(angle) * length
                );
                ctx.stroke();
            }
        }
    }
}

/**
 * Breath - Organic breathing circles
 */
export function drawBreath(ctx, width, height, audio, noise) {
    const gridSize = 40;
    const cols = Math.floor(width / gridSize);
    const rows = Math.floor(height / gridSize);

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;

    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            const x = i * gridSize + gridSize / 2;
            const y = j * gridSize + gridSize / 2;

            // Get audio value
            const index = Math.floor((i / cols) * audio.spectrum.length);
            const value = audio.spectrum[index] || 0;

            // Breathing animation with noise
            const noiseVal = noise.simplex3(i * 0.1, j * 0.1, audio.time * 0.3);
            const radius = (5 + value * 15) * (1 + noiseVal * 0.3);

            // Draw circle
            ctx.globalAlpha = 0.3 + value * 0.7;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    ctx.globalAlpha = 1;
}

/**
 * Horizon - Wavy horizontal lines
 */
export function drawHorizon(ctx, width, height, audio, noise) {
    const numLines = 20;
    const spacing = height / numLines;

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;

    for (let i = 0; i < numLines; i++) {
        const y = i * spacing;
        const audioInfluence = i / numLines;

        // Get audio value for this line
        const index = Math.floor(audioInfluence * audio.spectrum.length);
        const value = audio.spectrum[index] || 0;

        ctx.globalAlpha = 0.2 + value * 0.8;
        ctx.beginPath();

        // Draw wavy line
        for (let x = 0; x <= width; x += 5) {
            const wave = Math.sin(x * 0.02 + audio.time * 2) * 20 * value;
            const noiseWave = noise.simplex2(x * 0.01, i * 0.5 + audio.time * 0.5) * 10;

            if (x === 0) {
                ctx.moveTo(x, y + wave + noiseWave);
            } else {
                ctx.lineTo(x, y + wave + noiseWave);
            }
        }

        ctx.stroke();
    }

    ctx.globalAlpha = 1;
}

/**
 * Grid - Rotating crosses that respond to audio
 */
export function drawGrid(ctx, width, height, audio, noise) {
    const gridSize = 35;
    const cols = Math.floor(width / gridSize);
    const rows = Math.floor(height / gridSize);

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;

    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            const x = i * gridSize + gridSize / 2;
            const y = j * gridSize + gridSize / 2;

            // Get audio value
            const bassInfluence = audio.bass * 0.7;
            const highInfluence = audio.high * 0.3;
            const value = bassInfluence + highInfluence;

            // Rotation based on noise and time
            const angle = noise.simplex2(i * 0.1, j * 0.1) * Math.PI + audio.time;
            const size = 8 + value * 12;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);

            // Draw cross
            ctx.globalAlpha = 0.3 + value * 0.7;

            // Vertical line
            ctx.beginPath();
            ctx.moveTo(0, -size);
            ctx.lineTo(0, size);
            ctx.stroke();

            // Horizontal line
            ctx.beginPath();
            ctx.moveTo(-size, 0);
            ctx.lineTo(size, 0);
            ctx.stroke();

            ctx.restore();
        }
    }

    ctx.globalAlpha = 1;
}
