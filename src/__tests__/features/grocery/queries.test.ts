import { act, waitFor } from "@testing-library/react";
import {
  groceryKeys,
  useGroceryList,
  useGroceryListActions,
  useSavedGroceryLists,
} from "../../../features/grocery/queries";
import type { GroceryList, GroceryListSummary } from "../../../features/grocery/types";
import {
  createTestQueryClient,
  renderHookWithProviders,
  TEST_USER_ID,
} from "../../utils/renderWithProviders";

vi.mock("../../../features/grocery/api", () => ({
  listSavedGroceryLists: vi.fn(),
  getGroceryList: vi.fn(),
  saveGroceryList: vi.fn(),
  toggleGroceryItem: vi.fn(),
  uncheckAllGroceryItems: vi.fn(),
  renameGroceryList: vi.fn(),
  deleteGroceryList: vi.fn(),
}));

import {
  deleteGroceryList,
  getGroceryList,
  listSavedGroceryLists,
  renameGroceryList,
  saveGroceryList,
  toggleGroceryItem,
  uncheckAllGroceryItems,
} from "../../../features/grocery/api";

const SUMMARY: GroceryListSummary = {
  id: "list-1",
  title: "Week of May 25",
  savedPlanId: null,
  startDate: "2026-05-25",
  endDate: "2026-05-31",
  createdAt: "2026-05-25T12:00:00Z",
};
const LIST: GroceryList = {
  ...SUMMARY,
  items: [
    { id: "i1", ingredientName: "spinach", quantity: "2", unit: "bags", isChecked: false, category: "produce" },
    { id: "i2", ingredientName: "rice", quantity: "", unit: "", isChecked: true, category: null },
  ],
};

const listKey = groceryKeys.list(TEST_USER_ID, "list-1");
const summariesKey = groceryKeys.savedLists(TEST_USER_ID);

beforeEach(() => vi.clearAllMocks());

describe("grocery lookups", () => {
  it("useSavedGroceryLists loads the saved lists", async () => {
    vi.mocked(listSavedGroceryLists).mockResolvedValue([SUMMARY]);
    const { result } = renderHookWithProviders(() => useSavedGroceryLists());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.lists).toEqual([SUMMARY]));
  });

  it("useGroceryList loads nothing until a list is chosen, then reports errors", async () => {
    vi.mocked(getGroceryList).mockRejectedValue(new Error("List gone"));
    const { result, rerender } = renderHookWithProviders(
      ({ id }: { id: string | null }) => useGroceryList(id),
      { initialProps: { id: null as string | null } }
    );
    expect(result.current).toMatchObject({ list: null, loading: false });

    rerender({ id: "list-1" });
    await waitFor(() => expect(result.current.error).toBe("List gone"));
  });
});

describe("useGroceryListActions", () => {
  function setup() {
    const client = createTestQueryClient();
    client.setQueryData(summariesKey, [SUMMARY]);
    client.setQueryData(listKey, LIST);
    const { result } = renderHookWithProviders(() => useGroceryListActions(), { client });
    return { client, actions: result.current };
  }

  it("save caches the new list and refreshes the saved lists", async () => {
    const { client, actions } = setup();
    const saved: GroceryList = { ...LIST, id: "list-2", title: "Party" };
    vi.mocked(saveGroceryList).mockResolvedValue(saved);

    await act(() => actions.save("Party", { kind: "saved_plan", savedPlanId: "plan-1" }, []));

    expect(client.getQueryData(groceryKeys.list(TEST_USER_ID, "list-2"))).toEqual(saved);
    expect(client.getQueryState(summariesKey)?.isInvalidated).toBe(true);
  });

  it("toggleItem and uncheckAll update the cached list", async () => {
    const { client, actions } = setup();
    vi.mocked(toggleGroceryItem).mockResolvedValue(undefined);
    vi.mocked(uncheckAllGroceryItems).mockResolvedValue(undefined);

    await act(() => actions.toggleItem("list-1", "i1", true));
    expect(client.getQueryData<GroceryList>(listKey)?.items.map((i) => i.isChecked)).toEqual([true, true]);
    expect(toggleGroceryItem).toHaveBeenCalledWith("i1", true);

    await act(() => actions.uncheckAll("list-1"));
    expect(client.getQueryData<GroceryList>(listKey)?.items.map((i) => i.isChecked)).toEqual([false, false]);
  });

  it("rename updates both the summary and the open list", async () => {
    const { client, actions } = setup();
    vi.mocked(renameGroceryList).mockResolvedValue({ ...SUMMARY, title: "Groceries" });

    await act(() => actions.rename("list-1", "Groceries"));

    expect(client.getQueryData<GroceryListSummary[]>(summariesKey)?.[0].title).toBe("Groceries");
    expect(client.getQueryData<GroceryList>(listKey)?.title).toBe("Groceries");
  });

  it("remove drops the list from the summaries and the cache", async () => {
    const { client, actions } = setup();
    vi.mocked(deleteGroceryList).mockResolvedValue(undefined);

    await act(() => actions.remove("list-1"));

    expect(client.getQueryData(summariesKey)).toEqual([]);
    expect(client.getQueryData(listKey)).toBeUndefined();
  });

  it("does not touch the cache when saving fails", async () => {
    const { client, actions } = setup();
    vi.mocked(toggleGroceryItem).mockRejectedValue(new Error("offline"));

    await expect(actions.toggleItem("list-1", "i1", true)).rejects.toThrow("offline");
    expect(client.getQueryData(listKey)).toEqual(LIST);
  });
});
