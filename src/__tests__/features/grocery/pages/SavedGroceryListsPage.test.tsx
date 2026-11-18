import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../../utils/renderWithProviders";
import { MemoryRouter } from "react-router-dom";
import SavedGroceryListsPage from "../../../../features/grocery/pages/SavedGroceryListsPage";
import type { GroceryList, GroceryListSummary } from "../../../../features/grocery/types";

vi.mock("../../../../features/grocery/api", () => ({
  listSavedGroceryLists: vi.fn(),
  getGroceryList: vi.fn(),
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
  toggleGroceryItem,
  uncheckAllGroceryItems,
} from "../../../../features/grocery/api";

const SUMMARIES: GroceryListSummary[] = [
  { id: "list-1", title: "Week of May 25", savedPlanId: null, startDate: "2026-05-25", endDate: "2026-05-31", createdAt: "2026-05-25T12:00:00Z" },
  // Built from a saved plan, so it has no date range.
  { id: "list-2", title: "Party", savedPlanId: "plan-1", startDate: null, endDate: null, createdAt: "2026-06-01T12:00:00Z" },
];

const LIST_1: GroceryList = {
  ...SUMMARIES[0],
  items: [
    { id: "item-1", ingredientName: "spinach", quantity: "2", unit: "bags", isChecked: false, category: "produce", substitutes: [] },
    { id: "item-2", ingredientName: "rice", quantity: "", unit: "", isChecked: false, category: null, substitutes: [] },
  ],
};

const T = { timeout: 1500 };

function renderPage() {
  renderWithProviders(
    <MemoryRouter>
      <SavedGroceryListsPage />
    </MemoryRouter>
  );
}

async function expandFirstList() {
  renderPage();
  await screen.findByText("Week of May 25", undefined, T);
  fireEvent.click(screen.getAllByRole("button", { name: /view list/i })[0]);
  await screen.findByText("spinach", undefined, T);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listSavedGroceryLists).mockResolvedValue(SUMMARIES);
  vi.mocked(getGroceryList).mockResolvedValue(structuredClone(LIST_1));
  vi.mocked(toggleGroceryItem).mockResolvedValue(undefined);
  vi.mocked(uncheckAllGroceryItems).mockResolvedValue(undefined);
  vi.mocked(deleteGroceryList).mockResolvedValue(undefined);
});

describe("SavedGroceryListsPage — loading", () => {
  it("shows Loading… and then the saved lists", async () => {
    renderPage();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(await screen.findByText("Week of May 25", undefined, T)).toBeInTheDocument();
    expect(screen.getByText("Party")).toBeInTheDocument();
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  });

  it("shows the empty state when there are no saved lists", async () => {
    vi.mocked(listSavedGroceryLists).mockResolvedValue([]);
    renderPage();
    expect(
      await screen.findByText(/haven't saved any grocery lists yet/i, undefined, T)
    ).toBeInTheDocument();
  });

  it("shows the error when loading fails", async () => {
    vi.mocked(listSavedGroceryLists).mockRejectedValue(new Error("Network down"));
    renderPage();
    expect(await screen.findByText("Network down", undefined, T)).toBeInTheDocument();
    expect(screen.queryByText(/haven't saved any/i)).not.toBeInTheDocument();
  });
});

describe("SavedGroceryListsPage — dates", () => {
  it("shows the dates a list was built from, or when it was saved if it came from a saved plan", async () => {
    renderPage();
    expect(await screen.findByText("May 25, 2026 – May 31, 2026", undefined, T)).toBeInTheDocument();
    expect(screen.getByText("Saved Jun 1, 2026")).toBeInTheDocument();
  });
});

describe("SavedGroceryListsPage — viewing a list", () => {
  it("expands a list, shows its items grouped by category, and collapses again", async () => {
    await expandFirstList();
    expect(getGroceryList).toHaveBeenCalledWith("list-1");
    expect(screen.getByRole("heading", { name: "Produce" })).toBeInTheDocument();
    expect(screen.getByText("2 bags")).toBeInTheDocument();
    expect(screen.getByText("0/2 checked")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /hide list/i }));
    expect(screen.queryByText("spinach")).not.toBeInTheDocument();
  });

  it("shows an error if the list fails to load", async () => {
    vi.mocked(getGroceryList).mockRejectedValue(new Error("List gone"));
    renderPage();
    await screen.findByText("Week of May 25", undefined, T);
    fireEvent.click(screen.getAllByRole("button", { name: /view list/i })[0]);
    expect(await screen.findByText("List gone", undefined, T)).toBeInTheDocument();
  });

  it("checks an item, then unchecks all", async () => {
    await expandFirstList();

    fireEvent.click(screen.getByRole("checkbox", { name: /spinach/i }));
    await waitFor(() => expect(screen.getByText("1/2 checked")).toBeInTheDocument(), T);
    expect(toggleGroceryItem).toHaveBeenCalledWith("item-1", true);
    expect(screen.getByRole("checkbox", { name: /spinach/i })).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: /uncheck all/i }));
    await waitFor(() => expect(screen.getByText("0/2 checked")).toBeInTheDocument(), T);
    expect(uncheckAllGroceryItems).toHaveBeenCalledWith("list-1");
  });
});

describe("SavedGroceryListsPage — rename and delete", () => {
  it("renames a list and updates its title", async () => {
    vi.mocked(renameGroceryList).mockResolvedValue({ ...SUMMARIES[1], title: "Birthday party" });
    renderPage();
    await screen.findByText("Party", undefined, T);

    fireEvent.click(screen.getAllByRole("button", { name: "Rename" })[1]);
    const input = screen.getByDisplayValue("Party");
    fireEvent.change(input, { target: { value: "Birthday party" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Birthday party", undefined, T)).toBeInTheDocument();
    expect(renameGroceryList).toHaveBeenCalledWith("list-2", "Birthday party");
  });

  it("deletes a list after confirming", async () => {
    renderPage();
    await screen.findByText("Party", undefined, T);

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[1]);
    fireEvent.click(screen.getByRole("button", { name: /confirm delete/i }));

    await waitFor(() => expect(screen.queryByText("Party")).not.toBeInTheDocument(), T);
    expect(deleteGroceryList).toHaveBeenCalledWith("list-2");
    expect(screen.getByText("Week of May 25")).toBeInTheDocument();
  });
});
