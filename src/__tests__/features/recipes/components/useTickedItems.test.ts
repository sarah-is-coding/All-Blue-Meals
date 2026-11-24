import { act, renderHook } from "@testing-library/react";
import { useTickedItems } from "../../../../features/recipes/components/useTickedItems";

describe("useTickedItems", () => {
  it("ticks and unticks items, and counts them", () => {
    const { result } = renderHook(() => useTickedItems<number>("recipe-a"));
    expect(result.current.count).toBe(0);

    act(() => result.current.toggle(1));
    act(() => result.current.toggle(3));
    expect(result.current.isTicked(1)).toBe(true);
    expect(result.current.isTicked(2)).toBe(false);
    expect(result.current.count).toBe(2);

    act(() => result.current.toggle(1));
    expect(result.current.isTicked(1)).toBe(false);
    expect(result.current.count).toBe(1);
  });

  it("resets on request", () => {
    const { result } = renderHook(() => useTickedItems<string>("recipe-a"));
    act(() => result.current.toggle("salt"));
    act(() => result.current.reset());
    expect(result.current.count).toBe(0);
  });

  it("unticks everything when the reset key changes, and only then", () => {
    const { result, rerender } = renderHook(({ key }) => useTickedItems<number>(key), {
      initialProps: { key: "recipe-a" },
    });
    act(() => result.current.toggle(0));

    rerender({ key: "recipe-a" });
    expect(result.current.isTicked(0)).toBe(true);

    rerender({ key: "recipe-b" });
    expect(result.current.isTicked(0)).toBe(false);
    expect(result.current.count).toBe(0);
  });
});
