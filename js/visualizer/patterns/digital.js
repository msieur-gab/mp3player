/**
 * DIGITAL Pattern - Structured Grid Rain
 *
 * A fixed grid of vertical dashes. "Drops" of light travel down the columns
 * in discrete steps. Unlike 'Rain' or 'Cascade', this never breaks the grid.
 * It's a clean, digital data-stream aesthetic.
 *
 * Audio mapping:
 * - Bass: Spawns new drops at the top
 * - Mids: Controls the brightness of the trails
 * - Highs: Randomly glitters existing drops
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {object} frame - Audio data frame
 * @param {object} noise - Noise generator instance
 */
export function drawDigital(ctx, width, height, frame, noise) {
    const { spectrum, energy, beatPulse, isPlaying } = frame;
    
    // Grid Setup
    const colWidth = 20 / (frame.qualityMultiplier || 1);
    const rowHeight = 30 / (frame.qualityMultiplier || 1);
    const cols = Math.ceil(width / colWidth);
    const rows = Math.ceil(height / rowHeight);
    
    ctx.lineCap = 'butt';

    // Use time to drive the discrete downward motion
    // We want discrete steps, so we use Math.floor
    const speed = 8.0; // Rows per second
    const scrollOffset = Math.floor(frame.time * speed);

    for (let c = 0; c < cols; c++) {
        // Column audio value
        const colNorm = c / cols;
        const freqIndex = Math.floor(colNorm * 40);
        const colAudio = spectrum[freqIndex] || 0;

        // Noise field defines where the "streams" are
        // We sample noise at (column, time - vertical_position)
        // This makes the noise pattern "move" down
        
        for (let r = 0; r < rows; r++) {
            const x = c * colWidth + colWidth/2;
            const y = r * rowHeight + rowHeight/2;

            // Shift y-coord in noise space to simulate falling
            const noiseY = (r - scrollOffset) * 0.1;
            const noiseVal = noise.perlin(c * 0.5, noiseY);
            
            // Threshold determines if a "drop" is here
            // Bass energy widens the stream (lowers threshold)
            let isActive = false;
            let alpha = 0.1;

            if (isPlaying) {
                const threshold = 0.6 - (energy.bass * 0.3) - (colAudio * 0.2);
                if (noiseVal > threshold) {
                    isActive = true;
                    // Alpha fade based on trail (noise gradient)
                    alpha = (noiseVal - threshold) * 2.0; 
                    // Boost brightness with audio
                    alpha += colAudio * 0.8;
                }
            } else {
                // Idle animation
                if (noiseVal > 0.7) {
                    isActive = true;
                    alpha = 0.3;
                }
            }

            if (isActive) {
                // Draw vertical dash
                const len = rowHeight * 0.6;
                let thickness = 2.0;
                
                if (isPlaying) {
                    thickness = 1.0 + colAudio * 3.0;
                    // Highs make it white-hot
                    if (energy.high > 0.6 && Math.random() < 0.1) {
                        alpha = 1.0; 
                        thickness = 3.0;
                    }
                }

                ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, alpha)})`;
                ctx.lineWidth = thickness;
                ctx.beginPath();
                ctx.moveTo(x, y - len/2);
                ctx.lineTo(x, y + len/2);
                ctx.stroke();
            }
        }
    }
}

export const metadata = {
    name: 'Digital',
    description: 'Structured grid of falling data streams',
    author: 'MP3Player',
    responsive: true,
    optimized: true
};
