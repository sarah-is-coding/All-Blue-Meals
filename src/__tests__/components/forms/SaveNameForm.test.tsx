import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SaveNameForm from "../../../components/forms/SaveNameForm";

function renderForm(props: Partial<Parameters<typeof SaveNameForm>[0]> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onCancel = vi.fn();
  render(<SaveNameForm placeholder="List name" onSave={onSave} onCancel={onCancel} {...props} />);
  return { onSave, onCancel, input: screen.getByPlaceholderText("List name") };
}

describe("SaveNameForm", () => {
  it("starts with the initial name, focused", () => {
    const { input } = renderForm({ initialName: "Groceries" });
    expect(input).toHaveValue("Groceries");
    expect(input).toHaveFocus();
  });

  it("disables Save until there's a name", async () => {
    const user = userEvent.setup();
    const { input } = renderForm();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await user.type(input, "   ");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("saves the trimmed name with the button or Enter", async () => {
    const user = userEvent.setup();
    const { onSave, input } = renderForm();
    await user.type(input, "  Week one  ");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenLastCalledWith("Week one");

    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
  });

  it("shows Saving… and blocks a second save while saving", async () => {
    const user = userEvent.setup();
    let finish: () => void = () => {};
    const onSave = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const { input } = renderForm({ onSave, initialName: "A" });

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSave).toHaveBeenCalledTimes(1);

    finish();
    expect(await screen.findByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("shows the error from a failed save", async () => {
    const user = userEvent.setup();
    renderForm({ initialName: "A", onSave: vi.fn().mockRejectedValue(new Error("Name taken")) });
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Name taken")).toBeInTheDocument();
  });

  it("falls back to the caller's message for a non-Error failure", async () => {
    const user = userEvent.setup();
    renderForm({
      initialName: "A",
      onSave: vi.fn().mockRejectedValue("boom"),
      errorFallback: "Failed to save plan.",
    });
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Failed to save plan.")).toBeInTheDocument();
  });

  it("cancels with the button or Escape", async () => {
    const user = userEvent.setup();
    const { onCancel, input } = renderForm();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("adds the caller's class to the wrapper", () => {
    const { input } = renderForm({ className: "custom-save-form" });
    expect(input.closest(".save-name-form")).toHaveClass("custom-save-form");
  });
});
