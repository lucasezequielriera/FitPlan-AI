describe("Home flow", () => {
  it("loads and navigates through steps", () => {
    cy.visit("/");
    cy.contains("FitPlan AI").should("exist");
    cy.contains("Siguiente").click();
    cy.contains("Siguiente").click();
    cy.contains("Generar mi plan").should("exist");
  });
});

