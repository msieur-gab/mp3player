/**
 * ARCS Pattern - Grid of rotating circular arcs
 *
 * A grid of circular arcs that rotate and change length based on audio.
 * Classic generative art aesthetic (Bauhaus/Braun style).
 *
 * Audio mapping:
 * - Rotation: Controlled by Perlin noise flow field
 * - Arc Length: Bass intensity determines how "complete" the circle is
 * - Thickness: Mids control line weight
 * - Radius: Highs modulate the size slightly
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {object} frame - Audio data frame
 * @param {object} noise - Noise generator instance
 */
export function drawArcs(ctx, width, height, frame, noise) {
    // OPTIMIZATION: Grid density
    const baseGridStep = 40;
    const gridStep = baseGridStep / (frame.qualityMultiplier || 1);
    
    const { spectrum, energy, beatPulse, isPlaying } = frame;
    
    ctx.lineCap = 'round';

    for (let y = gridStep / 2; y < height; y += gridStep) {
        const rowNorm = y / height;
        const freqIndex = Math.floor((1 - rowNorm) * 30);
        const rowAudio = spectrum[freqIndex] || 0;

        for (let x = gridStep / 2; x < width; x += gridStep) {
            const colNorm = x / width;
            
            // Perlin noise for rotation
            const noiseVal = noise.perlin(
                x * 0.005, 
                y * 0.005 + frame.time * 0.1
            );
            
            // Base properties
            let radius = gridStep * 0.35;
            let startAngle = noiseVal * Math.PI * 2;
            let endAngle = startAngle + Math.PI; // Half circle by default
            let thickness = 1.5;
            let alpha = 0.4;

            if (isPlaying) {
                // Audio reactive
                const audioVal = rowAudio; // Use row frequency
                
                // Radius pulse on beat
                radius = radius * (1 + beatPulse * 0.2 + energy.high * 0.1);
                
                // Arc length based on audio intensity
                // Quiet = small arc, Loud = almost full circle
                const arcLen = Math.PI * 0.2 + (audioVal * Math.PI * 1.8);
                endAngle = startAngle + arcLen;

                // Thickness
                thickness = 1.0 + (audioVal * 3.0);
                
                // Alpha
                alpha = 0.3 + (audioVal * 0.7);
            }

            ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, alpha)})`;
            ctx.lineWidth = Math.min(4, thickness);
            
            ctx.beginPath();
            ctx.arc(x, y, radius, startAngle, endAngle);
            ctx.stroke();
        }
    }
}

export const metadata = {
    name: 'Arcs',
    description: 'Grid of rotating circular arcs (Bauhaus style)',
    author: 'MP3Player',
    responsive: true,
    optimized: true
};
