import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../utils/renderWithProviders";
import GroceryListCard from "../../../../features/grocery/components/GroceryListCard";
import type { GroceryItemDraft } from "../../../../features/grocery/types";

const ITEMS: GroceryItemDraft[] = [
  { ingredientName: "tortillas", quantity: "8", unit: "", category: "bakery_bread", substitutes: [] },
  { ingredientName: "ground beef", quantity: "1", unit: "lb", category: "meat_seafood", substitutes: [] },
];

function renderCard(items: GroceryItemDraft[] = ITEMS) {
  renderWithProviders(
    <GroceryListCard items={items} sourceLabel="May 24, 2026 – May 30, 2026" />
  );
}

describe("GroceryListCard", () => {
  it("titles the list by its source and shows the checked count", () => {
    renderCard();
    expect(screen.getByRole("heading", { name: "Grocery List · May 24, 2026 – May 30, 2026" })).toBeInTheDocument();
    expect(screen.getByText("0/2 checked")).toBeInTheDocument();
  });

  // Checkmarks now live on the card and start fresh when it is mounted again.
  it("tracks checkmarks for the current card", async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(
      <GroceryListCard items={ITEMS} sourceLabel="This week" />
    );

    await user.click(screen.getByRole("checkbox", { name: /tortillas/ }));
    expect(screen.getByRole("checkbox", { name: /tortillas/ })).toBeChecked();
    expect(screen.getByText("1/2 checked")).toBeInTheDocument();

    unmount();
    renderCard();
    expect(screen.getByRole("checkbox", { name: /tortillas/ })).not.toBeChecked();
    expect(screen.getByText("0/2 checked")).toBeInTheDocument();
  });

  it("explains an empty list", () => {
    renderCard([]);
    expect(screen.getByText(/No ingredients found/)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
