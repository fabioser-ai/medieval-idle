/** Minimal DOM IO recorder: no layout engine. UI logic and event handlers run real. */
export class ElementBoundary {
  children: ElementBoundary[] = [];
  attributes: Record<string, string> = {};
  listeners: Record<string, () => void> = {};
  ownerDocument = { createElement: (tag: string) => new ElementBoundary(tag) };
  hidden = false;
  disabled = false;
  value = '';
  textContent = '';
  className = '';
  id = '';
  type = '';
  min = '';
  max = '';
  step = '';
  focused = false;
  constructor(readonly tag: string) {}
  append(...children: ElementBoundary[]): void {
    this.children.push(...children);
  }
  replaceChildren(...children: ElementBoundary[]): void {
    this.children = children;
  }
  querySelector(tag: string): ElementBoundary | undefined {
    return this.all().find((node) => node.tag === tag);
  }
  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }
  addEventListener(name: string, callback: () => void): void {
    this.listeners[name] = callback;
  }
  removeEventListener(name: string, callback: () => void): void {
    if (this.listeners[name] === callback) delete this.listeners[name];
  }
  focus(): void {
    this.focused = true;
  }
  fire(event: string): void {
    this.listeners[event]?.();
  }
  all(): ElementBoundary[] {
    return [this, ...this.children.flatMap((c) => c.all())];
  }
}
