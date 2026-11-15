import { act, render, screen } from "@testing-library/react";
import LoadingModal from "../../../components/feedback/LoadingModal";
import {
  DEFAULT_MIN_VISIBLE_MS,
  DEFAULT_SHOW_DELAY_MS,
} from "../../../components/feedback/useLoadingGate";

// Fake timers are fine here: these tests advance time directly with act()
// and never use waitFor.
describe("LoadingModal", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

  it("never appears for work that finishes before the show delay", () => {
    const { rerender } = render(<LoadingModal open title="Loading recipe..." />);
    advance(DEFAULT_SHOW_DELAY_MS - 10);
    rerender(<LoadingModal open={false} title="Loading recipe..." />);
    advance(1000);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("appears after the show delay with the caller's text", () => {
    render(<LoadingModal open title="Signing you out..." message="Wrapping up." />);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    advance(DEFAULT_SHOW_DELAY_MS);
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Signing you out...");
    expect(dialog).toHaveTextContent("Wrapping up.");
  });

  it("stays up for the minimum time once shown, even if work finishes right away", () => {
    const { rerender } = render(<LoadingModal open />);
    advance(DEFAULT_SHOW_DELAY_MS);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    rerender(<LoadingModal open={false} />);
    advance(DEFAULT_MIN_VISIBLE_MS - 10);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    advance(10);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("hides as soon as work ends if it has already been up long enough", () => {
    const { rerender } = render(<LoadingModal open />);
    advance(DEFAULT_SHOW_DELAY_MS + DEFAULT_MIN_VISIBLE_MS + 100);

    rerender(<LoadingModal open={false} />);
    advance(0);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("uses default text when none is given", () => {
    render(<LoadingModal open />);
    advance(DEFAULT_SHOW_DELAY_MS);
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Working on your request...");
  });
});
