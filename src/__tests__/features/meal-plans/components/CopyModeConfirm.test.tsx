import { fireEvent, render, screen } from "@testing-library/react";
import CopyModeConfirm from "../../../../features/meal-plans/components/CopyModeConfirm";

describe("CopyModeConfirm", () => {
  it("explains the week already has meals", () => {
    render(<CopyModeConfirm startLabel="May 31" hasMeals onChoose={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText("The week starting May 31 already has meals.")).toBeInTheDocument();
  });

  it("reports which choice was made", () => {
    const onChoose = vi.fn();
    render(<CopyModeConfirm startLabel="May 31" hasMeals onChoose={onChoose} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Add on top" }));
    expect(onChoose).toHaveBeenLastCalledWith("add");
    fireEvent.click(screen.getByRole("button", { name: "Replace existing" }));
    expect(onChoose).toHaveBeenLastCalledWith("replace");
  });

  it("confirms or cancels applying meals to an empty week", () => {
    const onChoose = vi.fn();
    const onCancel = vi.fn();
    render(<CopyModeConfirm startLabel="May 31" hasMeals={false} onChoose={onChoose} onCancel={onCancel} />);

    expect(screen.getByText("Apply meals starting May 31?")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Replace existing" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onChoose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm apply" }));
    expect(onChoose).toHaveBeenCalledWith("add");
  });
});
