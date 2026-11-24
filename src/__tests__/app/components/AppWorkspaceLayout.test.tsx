import { fireEvent, render, screen, within } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
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

  it("has a Preferences link (the user icon) next to Sign out", () => {
    render(
      <MemoryRouter initialEntries={["/preferences"]}>
        <AppWorkspaceLayout />
      </MemoryRouter>
    );
    const preferences = screen.getByRole("link", { name: "Preferences" });
    expect(preferences).toHaveAttribute("href", "/preferences");
    expect(preferences).toHaveClass("workspace__preferences-link--active");
    expect(preferences.parentElement).toContainElement(screen.getByRole("button", { name: "Sign out" }));
  });

  // A new page used to keep the old page's scroll, so "Open recipe" from low on
  // the home page opened the recipe scrolled down to its notes.
  describe("scroll on navigation", () => {
    const scrollTo = vi.fn();
    beforeEach(() => {
      scrollTo.mockClear();
      window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    });

    function HomeStandIn() {
      const navigate = useNavigate();
      return (
        <>
          <Link to="/recipes/r-1">Open recipe</Link>
          <Link to="/recipes/r-1#notes">Notes</Link>
          <button type="button" onClick={() => navigate(-1)}>
            Go back
          </button>
        </>
      );
    }

    const renderApp = () =>
      render(
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<AppWorkspaceLayout />}>
              <Route index element={<HomeStandIn />} />
              <Route path="recipes/:recipeId" element={<HomeStandIn />} />
            </Route>
          </Routes>
        </MemoryRouter>
      );

    it("starts a new page at the top", () => {
      renderApp();
      scrollTo.mockClear();
      fireEvent.click(screen.getByRole("link", { name: "Open recipe" }));
      expect(scrollTo).toHaveBeenCalledWith(0, 0);
    });

    it("leaves a link to a spot on the page (#notes) to scroll there itself", () => {
      renderApp();
      scrollTo.mockClear();
      fireEvent.click(screen.getByRole("link", { name: "Notes" }));
      expect(scrollTo).not.toHaveBeenCalled();
    });

    it("keeps the browser's own position on Back", () => {
      renderApp();
      fireEvent.click(screen.getByRole("link", { name: "Open recipe" }));
      scrollTo.mockClear();
      fireEvent.click(screen.getByRole("button", { name: "Go back" }));
      expect(scrollTo).not.toHaveBeenCalled();
    });
  });
});
