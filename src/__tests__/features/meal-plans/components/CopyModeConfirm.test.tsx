import { fireEvent, render, screen } from "@testing-library/react";
import CopyModeConfirm from "../../../../features/meal-plans/components/CopyModeConfirm";

describe("CopyModeConfirm", () => {
  it("explains the week already has meals", () => {
    render(<CopyModeConfirm onChoose={vi.fn()} />);
    expect(screen.getByText(/already has meals/)).toBeInTheDocument();
  });

  it("reports which choice was made", () => {
    const onChoose = vi.fn();
    render(<CopyModeConfirm onChoose={onChoose} />);
    fireEvent.click(screen.getByRole("button", { name: "Add on top" }));
    expect(onChoose).toHaveBeenLastCalledWith("add");
    fireEvent.click(screen.getByRole("button", { name: "Replace existing" }));
    expect(onChoose).toHaveBeenLastCalledWith("replace");
  });
});
