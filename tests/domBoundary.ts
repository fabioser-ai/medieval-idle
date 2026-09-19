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
  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }
  addEventListener(name: string, callback: () => void): void {
    this.listeners[name] = callback;
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
