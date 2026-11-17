// Sideways gestures that page a calendar a month at a time. Both return the
// months to move: 1 (next), -1 (previous) or 0 (not a sideways gesture).
// Swiping or scrolling to the left shows the next month, like turning a page.

/** How far a finger must travel sideways to count as a swipe (px). */
export const SWIPE_MIN_PX = 40;

/**
 * A finished touch: it counts when it went mostly sideways and far enough,
 * so scrolling the page up and down never changes the month.
 */
export function swipeStep(dx: number, dy: number, minPx = SWIPE_MIN_PX): -1 | 0 | 1 {
  if (Math.abs(dx) < minPx || Math.abs(dx) < Math.abs(dy) * 1.5) return 0;
  return dx < 0 ? 1 : -1;
}

/** Sideways trackpad scrolling needed for one month (px of wheel delta). */
export const WHEEL_STEP_PX = 60;
/** Quiet time after a month change before sideways scrolling counts again (ms). */
export const WHEEL_COOLDOWN_MS = 300;

/**
 * Trackpads send a stream of wheel events per swipe, plus momentum after the
 * fingers lift. This adds up the sideways scrolling and moves one month per
 * swipe: after a change it ignores events until they stop for a moment.
 */
export function createWheelPager(stepPx = WHEEL_STEP_PX, cooldownMs = WHEEL_COOLDOWN_MS) {
  let total = 0;
  let quietUntil = 0;

  return function wheelStep(deltaX: number, deltaY: number, now: number): -1 | 0 | 1 {
    if (Math.abs(deltaX) <= Math.abs(deltaY)) return 0; // up/down scrolls the page
    if (now < quietUntil) {
      quietUntil = now + cooldownMs; // still the same swipe (or its momentum)
      return 0;
    }
    total += deltaX;
    if (Math.abs(total) < stepPx) return 0;
    const step = total > 0 ? 1 : -1;
    total = 0;
    quietUntil = now + cooldownMs;
    return step;
  };
}
