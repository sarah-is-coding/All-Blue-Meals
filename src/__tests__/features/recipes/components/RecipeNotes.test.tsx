import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RecipeNotes from "../../../../features/recipes/components/RecipeNotes";
import type { RecipeNote } from "../../../../features/recipes/types";
import { renderWithProviders } from "../../../utils/renderWithProviders";

vi.mock("../../../../features/recipes/api", () => ({
  listRecipeNotes: vi.fn(),
  addRecipeNote: vi.fn(),
  updateRecipeNote: vi.fn(),
  deleteRecipeNote: vi.fn(),
}));

import {
  addRecipeNote,
  deleteRecipeNote,
  listRecipeNotes,
  updateRecipeNote,
} from "../../../../features/recipes/api";

const note = (id: string, body: string, overrides: Partial<RecipeNote> = {}): RecipeNote => ({
  id,
  body,
  createdAt: "2026-11-03T18:20:00Z",
  updatedAt: "2026-11-03T18:20:00Z",
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listRecipeNotes).mockResolvedValue([]);
});

describe("RecipeNotes", () => {
  it("shows an empty state", async () => {
    renderWithProviders(<RecipeNotes recipeId="r1" />);
    expect(screen.getByRole("heading", { name: "Notes" })).toBeInTheDocument();
    expect(await screen.findByText("No notes yet. Add one after you cook this.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add note" })).toBeDisabled();
  });

  it("lists notes newest first with their date, keeping line breaks", async () => {
    vi.mocked(listRecipeNotes).mockResolvedValue([
      note("n2", "Less salt.\nMore lime.", { createdAt: "2026-11-10T12:00:00Z", updatedAt: "2026-11-10T12:00:00Z" }),
      note("n1", "Doubled the garlic."),
    ]);
    renderWithProviders(<RecipeNotes recipeId="r1" />);

    const items = await screen.findAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText("Nov 10, 2026")).toBeInTheDocument();
    expect(within(items[0]!).getByText(/Less salt\.\s+More lime\./)).toBeInTheDocument();
    expect(within(items[1]!).getByText("Doubled the garlic.")).toBeInTheDocument();
  });

  it("marks a note edited later as edited", async () => {
    vi.mocked(listRecipeNotes).mockResolvedValue([note("n1", "Good", { updatedAt: "2026-11-04T09:00:00Z" })]);
    renderWithProviders(<RecipeNotes recipeId="r1" />);
    expect(await screen.findByText("· edited")).toBeInTheDocument();
  });

  it("shows a load error", async () => {
    vi.mocked(listRecipeNotes).mockRejectedValue(new Error("Failed to load notes."));
    renderWithProviders(<RecipeNotes recipeId="r1" />);
    expect(await screen.findByText("Failed to load notes.")).toBeInTheDocument();
  });

  it("keeps the draft and shows the error when adding fails", async () => {
    const user = userEvent.setup();
    vi.mocked(addRecipeNote).mockRejectedValue(new Error("Couldn't save the note. Try again."));
    renderWithProviders(<RecipeNotes recipeId="r1" />);
    await screen.findByText(/No notes yet/);

    await user.type(screen.getByLabelText("New note"), "Great");
    await user.click(screen.getByRole("button", { name: "Add note" }));

    expect(await screen.findByText("Couldn't save the note. Try again.")).toBeInTheDocument();
    expect(screen.getByLabelText("New note")).toHaveValue("Great");
  });

  it("adds, edits and deletes a note", async () => {
    const user = userEvent.setup();
    vi.mocked(addRecipeNote).mockResolvedValue(note("n1", "Doubled the garlic."));
    vi.mocked(updateRecipeNote).mockResolvedValue(note("n1", "Tripled the garlic."));
    vi.mocked(deleteRecipeNote).mockResolvedValue();
    renderWithProviders(<RecipeNotes recipeId="r1" />);
    await screen.findByText(/No notes yet/);

    // Add
    await user.type(screen.getByLabelText("New note"), "Doubled the garlic.");
    await user.click(screen.getByRole("button", { name: "Add note" }));
    expect(addRecipeNote).toHaveBeenCalledWith("r1", "Doubled the garlic.");
    expect(await screen.findByText("Doubled the garlic.")).toBeInTheDocument();
    expect(screen.getByLabelText("New note")).toHaveValue("");

    // Edit
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const editBox = screen.getByLabelText("Edit note");
    await user.clear(editBox);
    await user.type(editBox, "Tripled the garlic.");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(updateRecipeNote).toHaveBeenCalledWith("n1", "Tripled the garlic.");
    expect(await screen.findByText("Tripled the garlic.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Edit note")).not.toBeInTheDocument();

    // Delete, after confirming
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("Delete this note?")).toBeInTheDocument();
    expect(deleteRecipeNote).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(deleteRecipeNote).toHaveBeenCalledWith("n1");
    await waitFor(() => expect(screen.getByText("No notes yet. Add one after you cook this.")).toBeInTheDocument());
  });

  it("cancels an edit without saving", async () => {
    const user = userEvent.setup();
    vi.mocked(listRecipeNotes).mockResolvedValue([note("n1", "Original")]);
    renderWithProviders(<RecipeNotes recipeId="r1" />);

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    await user.type(screen.getByLabelText("Edit note"), " changed");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(updateRecipeNote).not.toHaveBeenCalled();
    expect(screen.getByText("Original")).toBeInTheDocument();
  });

  // Smoother interactions: keyboard shortcuts, focus that stays put, and a
  // highlight on the note just added.
  it("adds with Ctrl+Enter, highlights the new note, and keeps the box ready for the next", async () => {
    vi.mocked(addRecipeNote).mockResolvedValue(note("n1", "Doubled the garlic."));
    renderWithProviders(<RecipeNotes recipeId="r1" />);
    await screen.findByText(/No notes yet/);

    const box = screen.getByLabelText("New note");
    fireEvent.change(box, { target: { value: "Doubled the garlic." } });
    fireEvent.keyDown(box, { key: "Enter", ctrlKey: true });

    expect(await screen.findByRole("list")).toBeInTheDocument();
    expect(addRecipeNote).toHaveBeenCalledWith("r1", "Doubled the garlic.");
    // The highlight is set once the save returns, just after the note appears.
    await waitFor(() =>
      expect(within(screen.getByRole("list")).getByRole("listitem")).toHaveClass("recipe-notes__item--new")
    );
    expect(box).toHaveValue("");
    expect(box).not.toBeDisabled();
  });

  it("counts the notes in the heading", async () => {
    vi.mocked(listRecipeNotes).mockResolvedValue([note("n1", "One"), note("n2", "Two")]);
    renderWithProviders(<RecipeNotes recipeId="r1" />);
    expect(await screen.findByText("2")).toHaveClass("recipe-notes__count");
  });

  it("cancels an edit with Esc and puts focus back on Edit", async () => {
    const user = userEvent.setup();
    vi.mocked(listRecipeNotes).mockResolvedValue([note("n1", "Original")]);
    renderWithProviders(<RecipeNotes recipeId="r1" />);

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    const editBox = screen.getByLabelText("Edit note");
    expect(editBox).toHaveFocus();
    await user.type(editBox, " changed");
    fireEvent.keyDown(editBox, { key: "Escape" });

    expect(screen.queryByLabelText("Edit note")).not.toBeInTheDocument();
    expect(screen.getByText("Original")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toHaveFocus();
    expect(updateRecipeNote).not.toHaveBeenCalled();
  });

  it("saves an edit with Ctrl+Enter and puts focus back on Edit", async () => {
    const user = userEvent.setup();
    vi.mocked(listRecipeNotes).mockResolvedValue([note("n1", "Original")]);
    vi.mocked(updateRecipeNote).mockResolvedValue(note("n1", "Original, again"));
    renderWithProviders(<RecipeNotes recipeId="r1" />);

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    const editBox = screen.getByLabelText("Edit note");
    await user.type(editBox, ", again");
    fireEvent.keyDown(editBox, { key: "Enter", ctrlKey: true });

    await waitFor(() => expect(updateRecipeNote).toHaveBeenCalled());
    expect(vi.mocked(updateRecipeNote).mock.calls[0]).toEqual(["n1", "Original, again"]);
    expect(await screen.findByText("Original, again")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit" })).toHaveFocus());
  });

  it("focuses Cancel when asking to confirm a delete", async () => {
    const user = userEvent.setup();
    vi.mocked(listRecipeNotes).mockResolvedValue([note("n1", "Original")]);
    renderWithProviders(<RecipeNotes recipeId="r1" />);

    await user.click(await screen.findByRole("button", { name: "Delete" }));
    const confirm = screen.getByRole("group", { name: "Confirm delete" });
    expect(within(confirm).getByRole("button", { name: "Cancel" })).toHaveFocus();
  });
});
