import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { notifications } from '@mantine/notifications';
import { server } from './server';

// Dexie (planner, shopping, AI chat storage) needs an IndexedDB; jsdom has none.
import 'fake-indexeddb/auto';

// Browser APIs Mantine (color scheme, AppShell/ScrollArea) depends on.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
// Sentinel-based auto-load (useAutoLoadMore) attaches an IntersectionObserver;
// jsdom has none. A never-firing stub keeps the observer inert — tests that
// need a page load trigger it via the manual retry path, not the sentinel.
if (!('IntersectionObserver' in globalThis)) {
  class IntersectionObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  globalThis.IntersectionObserver = IntersectionObserverStub as unknown as typeof IntersectionObserver;
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
// Mantine's autosize Textarea listens for font loads on document.fonts;
// jsdom doesn't implement FontFaceSet. A plain EventTarget carries the
// add/removeEventListener API and never fires, keeping the autosize inert.
if (!document.fonts) {
  Object.defineProperty(document, 'fonts', { value: new EventTarget() });
}

// Fail any network request without an explicit handler — no accidental
// real HTTP, and every new endpoint must be added to the handler files.
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));

afterEach(() => {
  server.resetHandlers();
  cleanup();
  // The notifications store is module-level — entries outlive unmount and
  // would leak into the next test's document.body assertions.
  notifications.clean();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterAll(() => server.close());
