/// <reference types="cypress" />

context('index', () => {
  beforeEach(() => {
    cy.visit('http://localhost:8080/index.html')
  })

  it('should find header', () => {
    cy.get('h1').contains('Hello World');
  });
})
