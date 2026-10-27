// A deliberately small DOM for testing the custom elements in Node without a dependency.
// It implements what src/profile-atlas.js touches: elements, shadow roots, attributes,
// simple selectors, the custom-element lifecycle (including upgrades) and events.

let upgrading = null;
let pendingTag = null;
const registry = new Map();

const camel = s => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

function matches(node, selector) {
  if (!node || !node.tagName) return false;
  return selector.split(',').some(part => {
    const s = part.trim().replace(/:not\([^)]*\)/g, '');
    const tag = s.match(/^[a-z][\w-]*/i)?.[0];
    if (tag && node.localName !== tag.toLowerCase()) return false;
    for (const [, c] of s.matchAll(/\.([\w-]+)/g)) if (!node.classList.contains(c)) return false;
    for (const [, name, value] of s.matchAll(/\[([\w-]+)(?:="?([^"\]]*)"?)?\]/g)) {
      if (!node.hasAttribute(name)) return false;
      if (value !== undefined && node.getAttribute(name) !== value) return false;
    }
    return true;
  });
}

class FakeNode {
  constructor() { this.childNodes = []; this.parentNode = null; this.listeners = {}; }
  get children() { return this.childNodes.filter(n => n.tagName); }
  get childElementCount() { return this.children.length; }
  get firstChild() { return this.childNodes[0] ?? null; }
  get textContent() { return this._text ?? this.childNodes.map(n => n.textContent).join(''); }
  set textContent(v) { this.replaceChildren(); this._text = String(v); }
  get isConnected() { let n = this; while (n) { if (n === globalThis.document) return true; n = n.parentNode || n.host; } return false; }
  _insert(nodes, at) {
    const list = nodes.map(n => (typeof n === 'string' ? new FakeText(n) : n));
    for (const n of list) { n.parentNode?._detach(n); n.parentNode = this; }
    this._text = undefined;
    this.childNodes.splice(at ?? this.childNodes.length, 0, ...list);
    if (this.isConnected) for (const n of list) connectTree(n);
  }
  _detach(n) { const i = this.childNodes.indexOf(n); if (i >= 0) this.childNodes.splice(i, 1); const was = this.isConnected; n.parentNode = null; if (was) disconnectTree(n); }
  append(...nodes) { this._insert(nodes); }
  appendChild(n) { this._insert([n]); return n; }
  prepend(...nodes) { this._insert(nodes, 0); }
  before(...nodes) { const p = this.parentNode; if (p) p._insert(nodes, p.childNodes.indexOf(this)); }
  remove() { this.parentNode?._detach(this); }
  replaceChildren(...nodes) { for (const n of [...this.childNodes]) this._detach(n); this._text = undefined; this._insert(nodes); }
  contains(n) { while (n) { if (n === this) return true; n = n.parentNode; } return false; }
  *descendants() { for (const c of this.childNodes) { if (c.tagName) { yield c; yield* c.descendants(); } } }
  querySelectorAll(sel) { return [...this.descendants()].filter(n => matches(n, sel)); }
  querySelector(sel) { for (const n of this.descendants()) if (matches(n, sel)) return n; return null; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter(x => x !== fn); }
  dispatchEvent(event) {
    if (!event.target) Object.defineProperty(event, 'target', { value: this, configurable: true });
    let n = this;
    while (n) {
      for (const fn of n.listeners[event.type] || []) fn.call(n, event);
      if (!event.bubbles) break;
      n = n.parentNode || (event.composed ? n.host : null);
    }
    return !event.defaultPrevented;
  }
}
class FakeText extends FakeNode { constructor(t) { super(); this._text = t; } }

class FakeElement extends FakeNode {
  constructor(tag) {
    super();
    this.localName = tag.toLowerCase(); this.tagName = tag.toUpperCase();
    this.attributes = new Map(); this.dataset = {}; this.hidden = false; this.disabled = false;
    const props = {};
    this.style = new Proxy(props, { get: (o, k) => k === 'setProperty' ? (a, b) => { o[a] = b; } : k === 'removeProperty' ? a => { delete o[a]; } : o[k] ?? '', set: (o, k, v) => { o[k] = v; return true; } });
    const el = this;
    this.classList = {
      get list() { return (el.getAttribute('class') || '').split(/\s+/).filter(Boolean); },
      contains(c) { return this.list.includes(c); },
      add(...c) { el.setAttribute('class', [...new Set([...this.list, ...c])].join(' ')); },
      remove(...c) { el.setAttribute('class', this.list.filter(x => !c.includes(x)).join(' ')); },
      toggle(c, force) { const on = force ?? !this.contains(c); on ? this.add(c) : this.remove(c); return on; },
    };
  }
  get className() { return this.getAttribute('class') || ''; }
  set className(v) { this.setAttribute('class', v); }
  get id() { return this.getAttribute('id') || ''; }
  set id(v) { this.setAttribute('id', v); }
  getAttribute(n) { return this.attributes.has(n) ? this.attributes.get(n) : null; }
  hasAttribute(n) { return this.attributes.has(n); }
  setAttribute(n, v) {
    const old = this.getAttribute(n); v = String(v); this.attributes.set(n, v);
    if (n.startsWith('data-')) this.dataset[camel(n.slice(5))] = v;
    this._attributeChanged(n, old, v);
  }
  removeAttribute(n) { const old = this.getAttribute(n); if (old === null) return; this.attributes.delete(n); this._attributeChanged(n, old, null); }
  _attributeChanged(n, old, v) {
    const observed = this.constructor.observedAttributes;
    if (observed?.includes(n) && typeof this.attributeChangedCallback === 'function') this.attributeChangedCallback(n, old, v);
  }
  closest(sel) { let n = this; while (n && n.tagName) { if (matches(n, sel)) return n; n = n.parentNode; } return null; }
  attachShadow() { this.shadowRoot = new FakeShadowRoot(this); return this.shadowRoot; }
  getBoundingClientRect() { return { width: 900, height: 600, left: 0, top: 0, right: 900, bottom: 600 }; }
  focus() { const root = this._root(); if (root) root.activeElement = this; }
  _root() { let n = this; while (n.parentNode) n = n.parentNode; return n instanceof FakeShadowRoot ? n : null; }
  get scrollWidth() { return 1000; }
  scrollIntoView() {}
  setPointerCapture() {}
  play() { return Promise.resolve(); }
  pause() {}
  click() { this.onclick?.({ target: this, preventDefault() {} }); this.dispatchEvent(new Event('click', { bubbles: true })); }
}
class FakeShadowRoot extends FakeNode {
  constructor(host) { super(); this.host = host; this.activeElement = null; }
  get isConnected() { return this.host.isConnected; }
}
class FakeDocument extends FakeNode {
  constructor() { super(); this.baseURI = 'http://localhost/docs/'; this.body = new FakeElement('body'); this.body.parentNode = this; this.childNodes.push(this.body); }
  get isConnected() { return true; }
  createElement(tag) {
    const cls = registry.get(tag.toLowerCase());
    if (cls) { pendingTag = tag; try { return new cls(); } finally { pendingTag = null; } }
    return new FakeElement(tag);
  }
  createElementNS(_ns, tag) { return new FakeElement(tag); }
}

function connectTree(n) {
  if (!n.tagName) return;
  if (typeof n.connectedCallback === 'function') n.connectedCallback();
  for (const c of [...n.childNodes]) connectTree(c);
  if (n.shadowRoot) for (const c of [...n.shadowRoot.childNodes]) connectTree(c);
}
function disconnectTree(n) {
  if (!n.tagName) return;
  if (typeof n.disconnectedCallback === 'function') n.disconnectedCallback();
  for (const c of n.childNodes) disconnectTree(c);
}

/** HTMLElement for subclasses: during an upgrade it hands back the existing element as `this`. */
class FakeHTMLElement extends FakeElement {
  constructor() {
    if (upgrading) { const el = upgrading; upgrading = null; return el; }
    super(pendingTag || 'unknown-element');
  }
}

export function installDom({ fetch } = {}) {
  registry.clear();
  const document = new FakeDocument();
  const store = new Map();
  Object.assign(globalThis, {
    document,
    HTMLElement: FakeHTMLElement,
    customElements: {
      get: name => registry.get(name),
      define(name, cls) {
        registry.set(name, cls);
        // Upgrade elements already in the document, in the spec's order:
        // constructor, then attributeChangedCallback per attribute, then connectedCallback.
        for (const el of document.querySelectorAll(name)) {
          if (el instanceof cls) continue;
          Object.setPrototypeOf(el, cls.prototype);
          upgrading = el; new cls();
          for (const [attr, value] of el.attributes) if (cls.observedAttributes?.includes(attr)) el.attributeChangedCallback(attr, null, value);
          if (el.isConnected) el.connectedCallback?.();
        }
      },
    },
    localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    ResizeObserver: class { observe() {} disconnect() {} },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    fetch,
  });
  return document;
}

/** Let queued microtasks and awaited fetches settle. */
export const settle = async (rounds = 20) => { for (let i = 0; i < rounds; i++) await new Promise(r => setTimeout(r, 0)); };
