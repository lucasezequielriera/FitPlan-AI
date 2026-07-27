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

// jsdom doesn't implement IntersectionObserver, which framer-motion's
// `whileInView`/`viewport` features call on mount — without this, any
// component using those (e.g. the landing page) throws on render in tests.
class MockIntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}
(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = MockIntersectionObserver;

