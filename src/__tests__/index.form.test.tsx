import { render, screen } from "@testing-library/react";
import Home from "@/pages/index";

describe("Home landing page", () => {
  test("renders the hero heading and primary CTA without crashing", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    // La landing tiene un botón principal que abre el modal de registro —
    // sea cual sea el copy exacto (viene de homeLandingCopy.ts), debe existir
    // al menos un botón de tipo "button" visible en el hero.
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });
});
