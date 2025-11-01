import { render, screen, fireEvent } from "@testing-library/react";
import Home from "@/pages/index";

describe("Home form", () => {
  test("progresses steps and shows submit", () => {
    render(<Home />);
    expect(screen.getByText(/FitPlan AI/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Siguiente/i));
    fireEvent.click(screen.getByText(/Siguiente/i));
    expect(screen.getByText(/Generar mi plan/i)).toBeInTheDocument();
  });
});

