import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CadenceUnitMenu from "../../../../features/preferences/components/CadenceUnitMenu";

describe("CadenceUnitMenu", () => {
  it("shows the current unit and is closed at first", () => {
    render(<CadenceUnitMenu value="week" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Unit: weeks" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens, marks the current unit, and picks another", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CadenceUnitMenu value="week" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Unit: weeks" }));
    expect(screen.getByRole("menuitemradio", { name: "weeks" })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("menuitemradio", { name: "months" }));

    expect(onChange).toHaveBeenCalledWith("month");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("doesn't report a change when the current unit is picked again", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CadenceUnitMenu value="day" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Unit: days" }));
    await user.click(screen.getByRole("menuitemradio", { name: "days" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("closes on a tap outside or Escape", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <p>Elsewhere</p>
        <CadenceUnitMenu value="week" onChange={vi.fn()} />
      </div>
    );

    await user.click(screen.getByRole("button", { name: "Unit: weeks" }));
    fireEvent.pointerDown(screen.getByText("Elsewhere"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Unit: weeks" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
