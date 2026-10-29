/**
 * Minimal DOM stand-in for dev-panel tests: the harness only needs
 * `createElement`, attributes, `append`, `remove` and click listeners, so a
 * node-environment test can drive the real panel wiring without jsdom.
 */

/** One fake element; `children` preserves append order for row lookups. */
export class FakeElement {
  readonly tagName: string;
  readonly attributes = new Map<string, string>();
  readonly children: FakeElement[] = [];
  readonly listeners = new Map<string, Array<() => void>>();
  textContent = "";
  id = "";
  type = "";
  removed = false;

  constructor(tagName: string) {
    this.tagName = tagName;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  append(...nodes: FakeElement[]): void {
    this.children.push(...nodes);
  }

  addEventListener(type: string, listener: () => void): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  remove(): void {
    this.removed = true;
  }

  click(): void {
    for (const listener of this.listeners.get("click") ?? []) {
      listener();
    }
  }

  /** Depth-first descendants that satisfy `predicate`. */
  queryAll(predicate: (element: FakeElement) => boolean): FakeElement[] {
    const found: FakeElement[] = [];
    for (const child of this.children) {
      if (predicate(child)) {
        found.push(child);
      }
      found.push(...child.queryAll(predicate));
    }
    return found;
  }

  /** First element whose text content and tag match. */
  findButton(label: string): FakeElement | null {
    return (
      this.queryAll(
        (element) => element.tagName === "button" && element.textContent === label,
      )[0] ?? null
    );
  }
}

/** Installed fake globals plus the panel container they expose. */
export interface FakeDom {
  body: FakeElement;
  head: FakeElement;
  window: Record<string, unknown>;
  restore(): void;
}

/** Replace `document`/`window` for one test and return a restore handle. */
export function installFakeDom(): FakeDom {
  const head = new FakeElement("head");
  const body = new FakeElement("body");
  const fakeDocument = {
    head,
    body,
    createElement: (tagName: string): FakeElement => new FakeElement(tagName),
  };
  const fakeWindow: Record<string, unknown> = { innerWidth: 1024 };
  Object.defineProperty(globalThis, "document", {
    value: fakeDocument,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, "window", {
    value: fakeWindow,
    configurable: true,
    writable: true,
  });
  return {
    body,
    head,
    window: fakeWindow,
    restore: (): void => {
      Reflect.deleteProperty(globalThis, "document");
      Reflect.deleteProperty(globalThis, "window");
    },
  };
}
