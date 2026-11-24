import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RecipeSteps from "../../../../features/recipes/components/RecipeSteps";

const INSTRUCTIONS = "1. Preheat the oven to 400°F.\n2. Roast the vegetables for 25 minutes.\n3. Serve.";

const steps = () => within(screen.getByRole("list")).getAllByRole("button");

describe("RecipeSteps", () => {
  it("shows each step on its own, numbered, without the typed numbers", () => {
    render(<RecipeSteps instructions={INSTRUCTIONS} />);

    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("1Preheat the oven to 400°F.");
    expect(screen.queryByText(/^1\./)).not.toBeInTheDocument();
    expect(screen.getByText("Tap a step to mark it done.")).toBeInTheDocument();
  });

  it("puts times and temperatures in bold", () => {
    render(<RecipeSteps instructions={INSTRUCTIONS} />);
    const bold = Array.from(document.querySelectorAll("strong.recipe-steps__cue")).map((cue) => cue.textContent);
    expect(bold).toEqual(["400°F", "25 minutes"]);
  });

  it("walks a cooking session: tick steps, see progress, untick, reset", async () => {
    const user = userEvent.setup();
    render(<RecipeSteps instructions={INSTRUCTIONS} />);
    expect(screen.queryByRole("button", { name: "Reset steps" })).not.toBeInTheDocument();

    await user.click(steps()[0]!);
    await user.click(steps()[1]!);
    expect(steps()[0]).toHaveAttribute("aria-pressed", "true");
    expect(steps()[0]).toHaveClass("recipe-steps__step--done");
    expect(steps()[2]).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("2 of 3 done")).toBeInTheDocument();

    // Tapping a done step un-ticks it.
    await user.click(steps()[1]!);
    expect(steps()[1]).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("1 of 3 done")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset steps" }));
    for (const step of steps()) expect(step).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText(/of 3 done/)).not.toBeInTheDocument();
  });

  it("starts over when the instructions change (e.g. after an edit)", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<RecipeSteps instructions={INSTRUCTIONS} />);
    await user.click(steps()[0]!);

    rerender(<RecipeSteps instructions={"1. Chop.\n2. Fry."} />);
    expect(steps()).toHaveLength(2);
    for (const step of steps()) expect(step).toHaveAttribute("aria-pressed", "false");
  });

  it("says when there are no instructions", () => {
    render(<RecipeSteps instructions={"  \n "} />);
    expect(screen.getByText("No instructions added yet.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
