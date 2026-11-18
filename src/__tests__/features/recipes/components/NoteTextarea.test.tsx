import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import NoteTextarea from "../../../../features/recipes/components/NoteTextarea";

// A form around the box, as the note forms use it.
function Harness({
  initial = "",
  onSubmit,
  onEscape,
  busy = false,
  autoFocus = false,
}: {
  initial?: string;
  onSubmit: () => void;
  onEscape?: () => void;
  busy?: boolean;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <NoteTextarea label="Note" value={value} onChange={setValue} onEscape={onEscape} busy={busy} autoFocus={autoFocus} />
    </form>
  );
}

describe("NoteTextarea", () => {
  it("submits its form with Ctrl+Enter or ⌘+Enter, but not plain Enter", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const box = screen.getByLabelText("Note");

    await user.type(box, "Great{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(box).toHaveValue("Great\n");

    fireEvent.keyDown(box, { key: "Enter", ctrlKey: true });
    fireEvent.keyDown(box, { key: "Enter", metaKey: true });
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("doesn't submit an empty note or while saving", () => {
    const onSubmit = vi.fn();
    const { unmount } = render(<Harness onSubmit={onSubmit} />);
    fireEvent.keyDown(screen.getByLabelText("Note"), { key: "Enter", ctrlKey: true });
    unmount();

    render(<Harness onSubmit={onSubmit} initial="Great" busy />);
    fireEvent.keyDown(screen.getByLabelText("Note"), { key: "Enter", ctrlKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("calls onEscape on Esc", () => {
    const onEscape = vi.fn();
    render(<Harness onSubmit={vi.fn()} onEscape={onEscape} />);
    fireEvent.keyDown(screen.getByLabelText("Note"), { key: "Escape" });
    expect(onEscape).toHaveBeenCalled();
  });

  it("keeps focus while saving: read-only, not disabled", () => {
    render(<Harness onSubmit={vi.fn()} initial="Great" busy />);
    const box = screen.getByLabelText("Note");
    expect(box).toHaveAttribute("readonly");
    expect(box).not.toBeDisabled();
  });

  it("starts with the cursor after the text when focused for editing", () => {
    render(<Harness onSubmit={vi.fn()} initial="Doubled the garlic" autoFocus />);
    const box = screen.getByLabelText("Note") as HTMLTextAreaElement;
    expect(box).toHaveFocus();
    expect(box.selectionStart).toBe("Doubled the garlic".length);
  });

  it("shows a character count only near the limit", () => {
    const { unmount } = render(<Harness onSubmit={vi.fn()} initial="short" />);
    expect(screen.queryByText(/\/ 2,000/)).not.toBeInTheDocument();
    unmount();

    render(<Harness onSubmit={vi.fn()} initial={"a".repeat(1850)} />);
    expect(screen.getByText("1,850 / 2,000")).toBeInTheDocument();
  });
});
