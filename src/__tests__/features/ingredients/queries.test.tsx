import { waitFor } from "@testing-library/react";
import { renderHookWithProviders } from "../../utils/renderWithProviders";
import { useIngredientMatches } from "../../../features/ingredients/queries";

vi.mock("../../../features/ingredients/api", () => ({
  findIngredientMatches: vi.fn(),
}));

import { findIngredientMatches } from "../../../features/ingredients/api";

const onion = { id: "i-1", name: "onion", category: "produce" as const, defaultUnit: null };

describe("useIngredientMatches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findIngredientMatches).mockResolvedValue(new Map([["onion", onion]]));
  });

  it("reports matches by key and which names are new once loaded", async () => {
    const { result } = renderHookWithProviders(() => useIngredientMatches(["Onions", "sumac"]));

    // Nothing is "new" while the lookup is still running.
    expect(result.current.isNew("sumac")).toBe(false);

    await waitFor(() => expect(result.current.isNew("sumac")).toBe(true));
    expect(result.current.matchFor("onions")).toEqual(onion);
    expect(result.current.isNew("Onions")).toBe(false);
  });

  it("doesn't query when there are no names", () => {
    const { result } = renderHookWithProviders(() => useIngredientMatches([]));
    expect(findIngredientMatches).not.toHaveBeenCalled();
    expect(result.current.matchFor("onion")).toBeNull();
    expect(result.current.isNew("onion")).toBe(false);
  });
});
