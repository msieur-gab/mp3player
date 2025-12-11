# Audio Visualizer - Performance Findings

## Date: 2025-12-11

## What We Built
- 5 animated canvas patterns (NEEDLES, BREATH, HORIZON, LINES, MOSAIC)
- 30fps rendering with frame skipping
- Real-time audio analysis using Web Audio API
- Pattern switcher UI
- Integrated into album detail view

## Performance Results

### Desktop (Chrome)
✅ **60fps version**: 16.7ms per frame (9.5% CPU)
✅ **30fps version**: 2.1ms per frame (6.3% CPU)
✅ **10fps version**: 8.5ms per frame (8.5% CPU) - felt laggy

**Winner**: 30fps - smooth visuals, low CPU usage

### Mobile (Real Device Test)
❌ **Critical Issue**: Sound degrades over time
❌ **Cause**: Memory saturation from continuous canvas rendering
❌ **Result**: Audio quality degradation - unacceptable for music player

## Root Cause
Even at 30fps with optimized rendering:
- Canvas operations accumulate memory
- Mobile browsers have limited resources
- Audio processing gets starved as memory fills
- Core functionality (music playback) compromised

## Conclusion
**Animated visualizers are not viable for mobile music PWA.**

The performance cost is too high and impacts the primary function (audio playback).

## Future Options

### Option 1: Static Spectrum Bars
- Simple FFT bars, update on beat only
- No continuous animation
- Minimal memory footprint
- Could work on mobile

### Option 2: Desktop-Only Feature
- Detect mobile and disable automatically
- Keep for desktop users only
- Adds complexity to maintain

### Option 3: Opt-In with Warning
- Disabled by default
- User can enable knowing the trade-offs
- Clear warning about battery/performance impact

### Option 4: Remove Entirely
- Focus on core music player features
- Keep code in git history for reference
- Simplest solution

## Recommendation
For a production music player PWA, **remove animated visualizer**.

If visual feedback is desired, implement:
- Simple play/pause icon animation
- Minimal beat pulse effect on album cover
- Static album art with subtle effects

**Priority**: Stable, high-quality audio playback > visual effects

## Branch Status
- Code: `feature/audio-visualizer`
- Status: Functional on desktop, problematic on mobile
- Action: Decision needed on whether to merge, simplify, or discard
