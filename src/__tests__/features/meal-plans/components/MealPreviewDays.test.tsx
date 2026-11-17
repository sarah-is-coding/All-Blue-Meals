import { render, screen } from "@testing-library/react";
import MealPreviewDays from "../../../../features/meal-plans/components/MealPreviewDays";

describe("MealPreviewDays", () => {
  it("lists each day with its recipes joined by dots", () => {
    render(
      <MealPreviewDays
        preview={[
          { dateIso: "2026-05-25", recipes: ["Tacos", "Soup"] },
          { dateIso: "2026-05-26", recipes: ["Chili"] },
        ]}
      />
    );
    expect(screen.getByText("Mon, May 25")).toBeInTheDocument();
    expect(screen.getByText("Tacos · Soup")).toBeInTheDocument();
    expect(screen.getByText("Tue, May 26")).toBeInTheDocument();
    expect(screen.getByText("Chili")).toBeInTheDocument();
  });

  it("shows a dash for a day with no recipes", () => {
    render(<MealPreviewDays preview={[{ dateIso: "2026-05-25", recipes: [] }]} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders nothing inside for an empty preview, and a compact variant", () => {
    const { container, rerender } = render(<MealPreviewDays preview={[]} />);
    expect(container.querySelector(".plan-browser__day")).toBeNull();
    rerender(<MealPreviewDays preview={[]} compact />);
    expect(container.firstChild).toHaveClass("plan-browser__preview--compact");
  });
});
