/**
 * Visualizer Patterns Registry
 *
 * Central export point for all visualizer patterns.
 * Each pattern is a self-contained module that can be easily added, removed, or modified.
 *
 * Pattern Interface:
 * - drawPattern(ctx, width, height, frame, noise) - Main render function
 * - metadata.name - Human-readable pattern name
 * - metadata.description - Pattern description
 * - metadata.author - Pattern author
 * - metadata.responsive - Whether pattern adapts to mobile
 * - metadata.optimized - Whether pattern includes performance optimizations
 *
 * Adding a new pattern:
 * 1. Create a new file in js/visualizer/patterns/your-pattern.js
 * 2. Export a function named drawYourPattern and metadata
 * 3. Import and add to the PATTERNS object below
 */

import { drawNeedles, metadata as needlesMetadata } from './needles.js';
import { drawBreath, metadata as breathMetadata } from './breath.js';
import { drawHorizon, metadata as horizonMetadata } from './horizon.js';
import { drawGrid, metadata as gridMetadata } from './grid.js';
import { drawMosaic, metadata as mosaicMetadata } from './mosaic.js';
import { drawFlow, metadata as flowMetadata } from './flow.js';
import { drawShift, metadata as shiftMetadata } from './shift.js';
import { drawFlux, metadata as fluxMetadata } from './flux.js';

/**
 * Pattern registry with metadata
 * Each entry contains the draw function and metadata
 */
export const PATTERNS = {
    needles: {
        draw: drawNeedles,
        ...needlesMetadata
    },
    breath: {
        draw: drawBreath,
        ...breathMetadata
    },
    horizon: {
        draw: drawHorizon,
        ...horizonMetadata
    },
    grid: {
        draw: drawGrid,
        ...gridMetadata
    },
    mosaic: {
        draw: drawMosaic,
        ...mosaicMetadata
    },
    flow: {
        draw: drawFlow,
        ...flowMetadata
    },
    shift: {
        draw: drawShift,
        ...shiftMetadata
    },
    flux: {
        draw: drawFlux,
        ...fluxMetadata
    }
};

/**
 * Get list of available pattern names
 */
export function getPatternNames() {
    return Object.keys(PATTERNS);
}

/**
 * Get pattern metadata
 */
export function getPatternMetadata(patternName) {
    return PATTERNS[patternName] || null;
}

/**
 * Get pattern draw function
 */
export function getPatternDrawFunction(patternName) {
    const pattern = PATTERNS[patternName];
    return pattern ? pattern.draw : null;
}

// Backward compatibility: Export draw functions directly
export { drawNeedles, drawBreath, drawHorizon, drawGrid, drawMosaic, drawFlow, drawShift, drawFlux };
