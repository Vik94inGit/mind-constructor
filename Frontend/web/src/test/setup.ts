import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// React Testing Library doesn't auto-unmount between tests under Vitest the
// way it does under Jest's global afterEach hook — do it explicitly so one
// test's rendered tree never leaks into the next.
afterEach(() => {
  cleanup();
});
