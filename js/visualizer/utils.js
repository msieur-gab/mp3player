/**
 * Noise - Perlin noise generator for organic animations
 */
class Noise {
    constructor(seed = 1) {
        this.seed = seed;
    }

    noise2D(x, y) {
        const n = Math.sin(x * 12.9898 + y * 78.233 + this.seed) * 43758.5453;
        return n - Math.floor(n);
    }

    perlin(x, y) {
        const xi = Math.floor(x);
        const yi = Math.floor(y);
        const xf = x - xi;
        const yf = y - yi;
        const a = this.noise2D(xi, yi);
        const b = this.noise2D(xi + 1, yi);
        const c = this.noise2D(xi, yi + 1);
        const d = this.noise2D(xi + 1, yi + 1);
        const u = xf * xf * (3 - 2 * xf);
        const v = yf * yf * (3 - 2 * yf);
        return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
    }
}

export default Noise;
