import { fireEvent, render, screen, within } from "@testing-library/react";
import GroceryItemGroups from "../../../../features/grocery/components/GroceryItemGroups";
import type { GroceryItem } from "../../../../features/grocery/types";

const item = (id: string, ingredientName: string, overrides: Partial<GroceryItem> = {}): GroceryItem => ({
  id,
  ingredientName,
  quantity: "",
  unit: "",
  isChecked: false,
  category: null,
  ...overrides,
});

const ITEMS = [
  item("1", "apples", { category: "produce", quantity: "3" }),
  item("2", "milk", { category: "dairy & eggs", quantity: "1", unit: "gal", isChecked: true }),
  item("3", "salt"),
];

// The grocery checklist shared by the grocery page and the saved-lists page.
describe("GroceryItemGroups", () => {
  it("groups items under their category, with their amounts", () => {
    render(<GroceryItemGroups items={ITEMS} onToggle={vi.fn()} />);
    expect(screen.getAllByRole("list")).toHaveLength(3);
    const milkRow = screen.getByText("milk").closest("li")!;
    expect(within(milkRow).getByText("1 gal")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows checked items as checked", () => {
    render(<GroceryItemGroups items={ITEMS} onToggle={vi.fn()} />);
    expect(screen.getByRole("checkbox", { name: /milk/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /apples/ })).not.toBeChecked();
    expect(screen.getByText("milk").closest("li")).toHaveClass("grocery-item--checked");
  });

  it("reports a toggle with the item and its new state", () => {
    const onToggle = vi.fn();
    render(<GroceryItemGroups items={ITEMS} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /apples/ }));
    expect(onToggle).toHaveBeenCalledWith(ITEMS[0], true);
  });

  it("disables only the item that's still saving", () => {
    render(<GroceryItemGroups items={ITEMS} onToggle={vi.fn()} savingItemId="2" />);
    expect(screen.getByRole("checkbox", { name: /milk/ })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /apples/ })).toBeEnabled();
  });
});
