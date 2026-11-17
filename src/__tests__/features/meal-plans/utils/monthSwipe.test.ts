import { describe, it, expect } from "vitest";
import {
  createWheelPager,
  SWIPE_MIN_PX,
  swipeStep,
  WHEEL_COOLDOWN_MS,
  WHEEL_STEP_PX,
} from "../../../../features/meal-plans/utils/monthSwipe";

describe("swipeStep", () => {
  it("swiping left shows the next month, right the previous", () => {
    expect(swipeStep(-80, 5)).toBe(1);
    expect(swipeStep(80, -5)).toBe(-1);
  });

  it("ignores taps and short drags", () => {
    expect(swipeStep(0, 0)).toBe(0);
    expect(swipeStep(SWIPE_MIN_PX - 1, 0)).toBe(0);
    expect(swipeStep(-SWIPE_MIN_PX, 0)).toBe(1); // exactly far enough counts
  });

  it("ignores mostly up/down movement, so scrolling the page never changes month", () => {
    expect(swipeStep(-60, 200)).toBe(0);
    expect(swipeStep(-60, 41)).toBe(0); // sideways must beat up/down by 1.5×
    expect(swipeStep(-60, 39)).toBe(1);
  });
});

describe("createWheelPager", () => {
  it("adds up sideways scrolling until it reaches a step", () => {
    const step = createWheelPager();
    expect(step(WHEEL_STEP_PX / 2, 0, 0)).toBe(0);
    expect(step(WHEEL_STEP_PX / 2, 0, 10)).toBe(1);
  });

  it("scrolling left goes back a month", () => {
    const step = createWheelPager();
    expect(step(-WHEEL_STEP_PX, 0, 0)).toBe(-1);
  });

  it("ignores up/down scrolling", () => {
    const step = createWheelPager();
    expect(step(10, 200, 0)).toBe(0);
    expect(step(WHEEL_STEP_PX, WHEEL_STEP_PX, 10)).toBe(0); // a tie is not sideways
  });

  it("moves only one month per swipe, ignoring its momentum", () => {
    const step = createWheelPager();
    expect(step(WHEEL_STEP_PX, 0, 0)).toBe(1);
    // Momentum keeps arriving every 16 ms: each event extends the quiet time.
    for (let t = 16; t <= 1000; t += 16) {
      expect(step(WHEEL_STEP_PX, 0, t)).toBe(0);
    }
  });

  it("counts again once the scrolling has stopped for the cooldown", () => {
    const step = createWheelPager();
    expect(step(WHEEL_STEP_PX, 0, 0)).toBe(1);
    expect(step(WHEEL_STEP_PX, 0, WHEEL_COOLDOWN_MS + 1)).toBe(1);
  });
});
