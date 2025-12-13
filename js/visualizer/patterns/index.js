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
import { drawPulse, metadata as pulseMetadata } from './pulse.js';
import { drawRain, metadata as rainMetadata } from './rain.js';
import { drawContour, metadata as contourMetadata } from './contour.js';
import { drawWeave, metadata as weaveMetadata } from './weave.js';
import { drawStrings, metadata as stringsMetadata } from './strings.js';
import { drawStrata, metadata as strataMetadata } from './strata.js';
import { drawCode, metadata as codeMetadata } from './code.js';
import { drawCascade, metadata as cascadeMetadata } from './cascade.js';
import { drawScan, metadata as scanMetadata } from './scan.js';
import { drawRibbonOrbit, metadata as ribbonOrbitMetadata } from './ribbon-orbit.js';
import { drawLatticeDrift, metadata as latticeDriftMetadata } from './lattice-drift.js';
import { drawEchoStrands, metadata as echoStrandsMetadata } from './echo-strands.js';
import { drawInterferenceField, metadata as interferenceFieldMetadata } from './interference-field.js';
import { drawPulseScan, metadata as pulseScanMetadata } from './pulse-scan.js';
import { drawArcs, metadata as arcsMetadata } from './arcs.js';
import { drawRays, metadata as raysMetadata } from './rays.js';
import { drawDigital, metadata as digitalMetadata } from './digital.js';
import { drawVibe, metadata as vibeMetadata } from './vibe.js';

/**
 * Pattern registry with metadata
 * Each entry contains the draw function and metadata
 */
export const PATTERNS = {
    needles: {
        draw: drawNeedles,
        ...needlesMetadata
    },
    digital: {
        draw: drawDigital,
        ...digitalMetadata
    },
    vibe: {
        draw: drawVibe,
        ...vibeMetadata
    },
    arcs: {
        draw: drawArcs,
        ...arcsMetadata
    },
    rays: {
        draw: drawRays,
        ...raysMetadata
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
    },
    pulse: {
        draw: drawPulse,
        ...pulseMetadata
    },
    rain: {
        draw: drawRain,
        ...rainMetadata
    },
    contour: {
        draw: drawContour,
        ...contourMetadata
    },
    weave: {
        draw: drawWeave,
        ...weaveMetadata
    },
    strings: {
        draw: drawStrings,
        ...stringsMetadata
    },
    strata: {
        draw: drawStrata,
        ...strataMetadata
    },
    code: {
        draw: drawCode,
        ...codeMetadata
    },
    cascade: {
        draw: drawCascade,
        ...cascadeMetadata
    },
    scan: {
        draw: drawScan,
        ...scanMetadata
    },
    ribbonOrbit: {
        draw: drawRibbonOrbit,
        ...ribbonOrbitMetadata
    },
    latticeDrift: {
        draw: drawLatticeDrift,
        ...latticeDriftMetadata
    },
    echoStrands: {
        draw: drawEchoStrands,
        ...echoStrandsMetadata
    },
    interferenceField: {
        draw: drawInterferenceField,
        ...interferenceFieldMetadata
    },
    pulseScan: {
        draw: drawPulseScan,
        ...pulseScanMetadata
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
export { drawNeedles, drawBreath, drawHorizon, drawGrid, drawMosaic, drawFlow, drawShift, drawFlux, drawPulse, drawRain, drawContour, drawWeave, drawStrings, drawStrata, drawCode, drawCascade, drawScan, drawRibbonOrbit, drawLatticeDrift, drawEchoStrands, drawInterferenceField, drawPulseScan, drawArcs, drawRays, drawDigital, drawVibe };
