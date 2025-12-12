/**
 * Visualizer Patterns - 30fps optimized with adaptive quality
 * Each pattern is a pure function that draws to canvas
 * OPTIMIZATION 4: Patterns adapt grid density based on device capability
 */

/**
 * NEEDLES - Grid of dots that shoot lines outward
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

/**
 * BREATH - Grid of rotating dashes
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

/**
 * HORIZON - Horizontal wavy strings
 */
export function drawHorizon(ctx, width, height, frame, noise) {
    // OPTIMIZATION 4: Reduce line count on mobile (24 -> 12 lines)
    const baseNumLines = 24;
    const numLines = Math.floor(baseNumLines * (frame.qualityMultiplier || 1));
    const { spectrum, beatPulse, isPlaying } = frame;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < numLines; i++) {
        const t = i / 19;
        const yBase = 20 + Math.pow(t, 1.2) * (height - 40);
        const safeT = Math.min(1, t);
        const freqIndex = Math.floor((1 - safeT) * 30);
        const baseVal = spectrum[freqIndex] || 0;

        ctx.beginPath();
        for (let x = 0; x <= width; x += 8) {
            const noiseVal = noise.perlin(x * 0.003 + frame.time * 0.1, yBase * 0.003);
            const xVal = spectrum[Math.floor((x/width) * spectrum.length)] || 0;
            const amp = (5 + t * 20) * (0.5 + baseVal + xVal * 0.5 + beatPulse * 0.2);
            const yOffset = Math.sin(noiseVal * Math.PI * 4 + frame.time) * amp;

            if (x === 0) {
                ctx.moveTo(x, yBase + yOffset);
            } else {
                ctx.lineTo(x, yBase + yOffset);
            }
        }

        if (!isPlaying) {
            ctx.lineWidth = 1.5;
        } else {
            ctx.lineWidth = Math.min(4.0, 0.5 + (t * 2.0) + (beatPulse * 1.5));
        }

        const alpha = 0.2 + (t * 0.6) + (baseVal * 0.4);
        ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, alpha)})`;
        ctx.stroke();
    }
}

/**
 * GRID - Rotating crosses
 */
export function drawGrid(ctx, width, height, frame, noise) {
    // OPTIMIZATION 4: Reduce grid density on mobile
    const baseGridStep = 25;
    const gridStep = baseGridStep / (frame.qualityMultiplier || 1);
    const { spectrum, energy, isPlaying } = frame;
    ctx.lineCap = 'round';

    // OPTIMIZATION 5: Cache state settings to avoid redundant calls
    for (let y = gridStep/2; y < height; y += gridStep) {
        const t = y / height;

        for (let x = gridStep/2; x < width; x += gridStep) {
            const noiseVal = noise.perlin(x * 0.005, y * 0.005 + frame.time * 0.1);
            const angle = noiseVal * Math.PI * 2 + (energy.bass * 0.5);
            const bassVal = spectrum[Math.floor((x/width)*20)] || 0;
            const trebleVal = spectrum[Math.floor(spectrum.length - 20 + (x/width)*20)] || 0;

            const lenTop = 5 + (t * 4) + (bassVal * 20);
            const lenBot = 5 + (t * 4) + (trebleVal * 15);

            // Calculate line endpoints with rotation (avoiding save/restore)
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);
            const x1 = x + (0 * cosA - (-lenTop) * sinA);
            const y1 = y + (0 * sinA + (-lenTop) * cosA);
            const x2 = x + (0 * cosA - lenBot * sinA);
            const y2 = y + (0 * sinA + lenBot * cosA);

            if (!isPlaying) {
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = `rgba(255, 255, 255, 0.3)`;
            } else {
                let th = 0.5 + (t * 1.0) + (bassVal * 2.5 * t);
                ctx.lineWidth = Math.min(4.0, th);
                ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 + bassVal * 0.9})`;
            }

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
    }
}

/**
 * MOSAIC - Kinetic halftone dots
 */
export function drawMosaic(ctx, width, height, frame, noise) {
    // OPTIMIZATION 4: Reduce grid density on mobile (16 -> 32 size = 75% fewer cells)
    const baseGridSize = 16;
    const gridSize = baseGridSize / (frame.qualityMultiplier || 1);
    const cols = Math.ceil(width / gridSize);
    const rows = Math.ceil(height / gridSize);
    const { spectrum, beatPulse, isPlaying } = frame;

    for (let r = 0; r < rows; r++) {
        const t = r / (rows - 1);
        const freqIndex = Math.floor((1 - t) * 40);
        const rowVal = spectrum[freqIndex] || 0;

        for (let c = 0; c < cols; c++) {
            const cx = c * gridSize + gridSize/2;
            const cy = r * gridSize + gridSize/2;
            const noiseVal = noise.perlin(c * 0.1, r * 0.1 + frame.time);
            const val = rowVal * (0.8 + noiseVal * 0.4) + (beatPulse * 0.2 * t);

            let size;
            if (!isPlaying) {
                size = 2.0;
                ctx.fillStyle = `rgba(255, 255, 255, 0.3)`;
            } else {
                size = 0.5 + (val * 3.5);
                size = Math.max(0.5, Math.min(4.0, size));
                ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + val * 0.7})`;
            }

            const maxRad = size / 2;
            const morph = Math.min(1, val * 1.8);

            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(cx - size/2, cy - size/2, size, size, maxRad * morph);
            } else {
                if (val > 0.5) {
                    ctx.arc(cx, cy, size/2, 0, Math.PI*2);
                } else {
                    ctx.rect(cx - size/2, cy - size/2, size, size);
                }
            }
            ctx.fill();
        }
    }
}
