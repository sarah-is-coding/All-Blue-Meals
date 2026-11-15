import { act, renderHook } from "@testing-library/react";
import { useDebouncedValue } from "../../../lib/hooks/useDebouncedValue";

// Fake timers are fine here: these tests advance time directly with act()
// and never use waitFor.
describe("useDebouncedValue", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useDebouncedValue("pasta", 200));
    expect(result.current).toBe("pasta");
  });

  it("updates only after the value stops changing for the delay", () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 200), {
      initialProps: { v: "p" },
    });

    rerender({ v: "pa" });
    act(() => vi.advanceTimersByTime(150));
    rerender({ v: "pas" });
    act(() => vi.advanceTimersByTime(150));
    expect(result.current).toBe("p");

    act(() => vi.advanceTimersByTime(50));
    expect(result.current).toBe("pas");
  });
});
