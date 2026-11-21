import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AppWorkspaceLayout from "../../../app/components/AppWorkspaceLayout";

vi.mock("../../../features/auth/api", () => ({ authService: { signOut: vi.fn() } }));

describe("AppWorkspaceLayout", () => {
  it("names the pages the same in the desktop header and the mobile bottom bar", () => {
    render(
      <MemoryRouter initialEntries={["/recipes"]}>
        <AppWorkspaceLayout />
      </MemoryRouter>
    );

    const [desktop, mobile] = screen.getAllByRole("navigation", { name: "Primary" });
    for (const nav of [desktop!, mobile!]) {
      const links = within(nav).getAllByRole("link");
      expect(links.map((link) => link.textContent)).toEqual(["Home", "Recipes", "Plans", "Grocery"]);
      expect(links.map((link) => link.getAttribute("href"))).toEqual(["/", "/recipes", "/meal-plans", "/grocery"]);
      expect(within(nav).getByRole("link", { name: "Recipes" })).toHaveClass("workspace-nav__link--active");
    }
  });
});
