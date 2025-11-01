import "@testing-library/jest-dom";

// Minimal Next.js router mock for component tests
jest.mock("next/router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    pathname: "/",
    query: {},
  }),
}));

