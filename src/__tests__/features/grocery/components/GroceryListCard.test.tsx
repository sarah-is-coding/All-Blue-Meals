import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { renderWithProviders } from "../../../utils/renderWithProviders";
import GroceryListCard from "../../../../features/grocery/components/GroceryListCard";
import type { GroceryItemDraft, GroceryList, GroceryListOrigin } from "../../../../features/grocery/types";

vi.mock("../../../../features/grocery/api", () => ({
  saveGroceryList: vi.fn(),
  toggleGroceryItem: vi.fn(),
}));

import { saveGroceryList, toggleGroceryItem } from "../../../../features/grocery/api";

const T = { timeout: 1500 };

const ITEMS: GroceryItemDraft[] = [
  { ingredientName: "tortillas", quantity: "8", unit: "", category: "bakery_bread", substitutes: [] },
  { ingredientName: "ground beef", quantity: "1", unit: "lb", category: "meat_seafood", substitutes: [] },
];
const ORIGIN: GroceryListOrigin = { kind: "range", startDate: "2026-05-24", endDate: "2026-05-30" };

function savedList(title: string, items: GroceryItemDraft[]): GroceryList {
  return {
    id: "list-1",
    title,
    savedPlanId: null,
    startDate: ORIGIN.kind === "range" ? ORIGIN.startDate : null,
    endDate: ORIGIN.kind === "range" ? ORIGIN.endDate : null,
    createdAt: "2026-05-25T12:00:00Z",
    items: items.map((item, i) => ({ ...item, id: `item-${i}`, isChecked: false })),
  };
}

function renderCard(items: GroceryItemDraft[] = ITEMS) {
  const user = userEvent.setup();
  renderWithProviders(
    <MemoryRouter>
      <GroceryListCard items={items} origin={ORIGIN} sourceLabel="May 24, 2026 – May 30, 2026" />
    </MemoryRouter>
  );
  return { user };
}

async function saveAs(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Save list…" }));
  await user.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText(/✓ Saved/, undefined, T);
}

// The grocery page's list after Build: ticking items, then saving.
describe("GroceryListCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(saveGroceryList).mockImplementation(async (title, _origin, items) => savedList(title, items));
    vi.mocked(toggleGroceryItem).mockResolvedValue(undefined);
  });

  it("titles an unsaved list by its source and counts ticked items", () => {
    renderCard();
    expect(screen.getByRole("heading", { name: "Grocery List · May 24, 2026 – May 30, 2026" })).toBeInTheDocument();
    expect(screen.getByText("0/2 checked")).toBeInTheDocument();
  });

  it("ticks items on an unsaved list without saving anything", async () => {
    const { user } = renderCard();
    await user.click(screen.getByRole("checkbox", { name: /tortillas/ }));
    expect(screen.getByRole("checkbox", { name: /tortillas/ })).toBeChecked();
    expect(screen.getByText("1/2 checked")).toBeInTheDocument();
    expect(toggleGroceryItem).not.toHaveBeenCalled();
  });

  it("saves with the source in the suggested name, then shows the saved list", async () => {
    const { user } = renderCard();
    await user.click(screen.getByRole("button", { name: "Save list…" }));
    expect(screen.getByPlaceholderText("List name")).toHaveValue("Grocery – May 24, 2026 – May 30, 2026");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/✓ Saved/, undefined, T)).toBeInTheDocument();
    expect(saveGroceryList).toHaveBeenCalledWith("Grocery – May 24, 2026 – May 30, 2026", ORIGIN, ITEMS);
    expect(screen.getByRole("heading", { name: "Grocery – May 24, 2026 – May 30, 2026" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save list…" })).not.toBeInTheDocument();
  });

  it("saves ticks to the database once the list is saved", async () => {
    const { user } = renderCard();
    await saveAs(user);

    await user.click(screen.getByRole("checkbox", { name: /ground beef/ }));
    await waitFor(() => expect(toggleGroceryItem).toHaveBeenCalledWith("item-1", true), T);
    expect(await screen.findByText("1/2 checked", undefined, T)).toBeInTheDocument();
  });

  it("leaves the item unticked and says so when saving a tick fails", async () => {
    vi.mocked(toggleGroceryItem).mockRejectedValue(new Error("Network down"));
    const { user } = renderCard();
    await saveAs(user);

    await user.click(screen.getByRole("checkbox", { name: /ground beef/ }));
    expect(await screen.findByText("Network down", undefined, T)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /ground beef/ })).not.toBeChecked();
  });

  it("explains an empty list and offers no save", () => {
    renderCard([]);
    expect(screen.getByText(/No ingredients found/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save list…" })).not.toBeInTheDocument();
  });
});
