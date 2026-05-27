import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

declare global {
  interface WindowEventMap {
    beforeinstallprompt: Event;
    appinstalled: Event;
  }

  interface Navigator {
    standalone?: boolean;
  }
}

const serviceWorkerRegisterMock = vi.fn(async () => ({
  installing: null,
  waiting: null,
  active: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  update: vi.fn(async () => undefined),
}));

beforeAll(() => {
  Object.defineProperty(globalThis.navigator, "serviceWorker", {
    configurable: true,
    value: {
      register: serviceWorkerRegisterMock,
      getRegistration: vi.fn(async () => null),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      controller: null,
    },
  });

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
  serviceWorkerRegisterMock.mockClear();
});

afterAll(() => {
  vi.restoreAllMocks();
});
