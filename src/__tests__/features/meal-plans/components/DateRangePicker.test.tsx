import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "../../../utils/renderWithProviders";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import DateRangePicker from "../../../../features/meal-plans/components/DateRangePicker";

// Mock the calendar with fixed day buttons; its month grid has its own tests.
vi.mock("../../../../features/meal-plans/components/MealDatesCalendar", () => ({
  default: ({
    onSelectDay,
    rangeStartIso,
    rangeEndIso,
  }: {
    rangeStartIso: string | null;
    rangeEndIso: string | null;
    onSelectDay: (dateIso: string) => void;
  }) => (
    <div data-testid="meal-dates-calendar" data-range={`${rangeStartIso}..${rangeEndIso}`}>
      {["2026-05-18", "2026-05-20", "2026-05-24"].map((iso) => (
        <button key={iso} type="button" onClick={() => onSelectDay(iso)}>
          Day {iso}
        </button>
      ))}
    </div>
  ),
}));

/** Render the picker the way both pages use it: controlled by the parent. */
function Harness({ initial }: { initial: { startIso: string; endIso: string } | null }) {
  const [range, setRange] = useState(initial);
  return (
    <DateRangePicker
      startIso={range?.startIso ?? null}
      endIso={range?.endIso ?? null}
      onChange={(startIso, endIso) => setRange({ startIso, endIso })}
    />
  );
}

const renderPicker = (initial: { startIso: string; endIso: string } | null = null) =>
  renderWithProviders(<Harness initial={initial} />);

const pickDay = (iso: string) =>
  fireEvent.click(screen.getByRole("button", { name: `Day ${iso}` }));

const calendarRange = () =>
  screen.getByTestId("meal-dates-calendar").getAttribute("data-range");

beforeEach(() => vi.clearAllMocks());

describe("DateRangePicker", () => {
  it("shows the given range in the fields and on the calendar", () => {
    renderPicker({ startIso: "2026-05-18", endIso: "2026-05-24" });
    expect(screen.getByLabelText("From")).toHaveValue("2026-05-18");
    expect(screen.getByLabelText("To")).toHaveValue("2026-05-24");
    expect(calendarRange()).toBe("2026-05-18..2026-05-24");
  });

  it("starts empty when nothing is picked yet", () => {
    renderPicker(null);
    expect(screen.getByLabelText("From")).toHaveValue("");
    expect(screen.getByLabelText("To")).toHaveValue("");
    expect(calendarRange()).toBe("null..null");
  });

  it("picks a range in two taps using the fields and highlight as feedback", () => {
    renderPicker(null);
    pickDay("2026-05-18");
    expect(screen.getByLabelText("From")).toHaveValue("2026-05-18");
    expect(screen.getByLabelText("To")).toHaveValue("2026-05-18");
    expect(screen.queryByText(/tap the last day/i)).not.toBeInTheDocument();

    pickDay("2026-05-24");
    expect(screen.getByLabelText("To")).toHaveValue("2026-05-24");
    expect(calendarRange()).toBe("2026-05-18..2026-05-24");
  });

  it("an earlier tap starts the range over", () => {
    renderPicker(null);
    pickDay("2026-05-20");
    pickDay("2026-05-18");
    expect(calendarRange()).toBe("2026-05-18..2026-05-18");
  });

  it("typing a complete date moves the calendar highlight too", () => {
    renderPicker({ startIso: "2026-05-18", endIso: "2026-05-24" });
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-05-20" } });
    expect(calendarRange()).toBe("2026-05-20..2026-05-24");
  });

  it("typing a date into an empty picker selects that single day", () => {
    renderPicker(null);
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-05-20" } });
    expect(screen.getByLabelText("To")).toHaveValue("2026-05-20");
    expect(calendarRange()).toBe("2026-05-20..2026-05-20");
  });

  it("never goes backwards: each end pulls the other along", () => {
    renderPicker({ startIso: "2026-05-18", endIso: "2026-05-24" });
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-06-10" } });
    expect(screen.getByLabelText("To")).toHaveValue("2026-06-10");

    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-06-01" } });
    expect(screen.getByLabelText("From")).toHaveValue("2026-06-01");
    expect(calendarRange()).toBe("2026-06-01..2026-06-01");
  });

  it("ignores half-typed dates and puts the committed one back on blur", () => {
    renderPicker({ startIso: "2026-05-18", endIso: "2026-05-24" });
    const from = screen.getByLabelText("From");
    fireEvent.change(from, { target: { value: "2026-0" } });
    // Nothing committed while typing…
    expect(calendarRange()).toBe("2026-05-18..2026-05-24");
    // …and leaving the field restores the committed date.
    fireEvent.blur(from);
    expect(from).toHaveValue("2026-05-18");
  });

  it("rejects impossible dates like February 31st", () => {
    renderPicker({ startIso: "2026-05-18", endIso: "2026-05-24" });
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-02-31" } });
    expect(calendarRange()).toBe("2026-05-18..2026-05-24");
  });
});
