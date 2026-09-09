import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const override = new URL('../../assets/js/menu.js', import.meta.url);
const source = readFileSync(existsSync(override) ? override : new URL('../../themes/re-terminal/assets/js/menu.js', import.meta.url), 'utf8');

function fixture() {
  let focused = null;
  function element() {
    const handlers = new Map();
    const attrs = new Map();
    const classes = new Set();
    return {
      style: {},
      classList: { contains: (s) => classes.has(s), add: (s) => classes.add(s), remove: (s) => classes.delete(s) },
      setAttribute: (k, v) => attrs.set(k, v),
      getAttribute: (k) => attrs.get(k),
      addEventListener: (name, fn) => { if (!handlers.has(name)) handlers.set(name, []); handlers.get(name).push(fn); },
      fire(name, data = {}) {
        const event = { target: this, key: '', defaultPrevented: false, stopPropagation() {}, preventDefault() { this.defaultPrevented = true; }, ...data };
        for (const fn of handlers.get(name) || []) fn(event);
        return event;
      },
      focus() { focused = this; },
      getBoundingClientRect: () => ({ right: 500 }),
    };
  }
  const menus = [0, 1].map(() => {
    const menu = element();
    menu.trigger = element();
    menu.trigger.setAttribute('aria-expanded', 'false');
    menu.dropdown = element();
    menu.querySelector = (s) => s === '.menu__trigger' ? menu.trigger : menu.dropdown;
    return menu;
  });
  const body = element();
  const window = element();
  const container = element();
  vm.runInNewContext(source, { document: { body, querySelector: () => container, querySelectorAll: () => menus }, window });
  return { menus, body, window, focused: () => focused };
}

test('Escape from an open dropdown closes it and returns focus', () => {
  const f = fixture();
  const menu = f.menus[0];
  menu.trigger.fire('click');
  menu.fire('keydown', { key: 'Escape', target: menu.dropdown });
  assert.equal(menu.classList.contains('open'), false);
  assert.equal(menu.trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(f.focused(), menu.trigger);
});

test('click toggles both menu visibility and expanded state', () => {
  const { menus: [menu] } = fixture();
  menu.trigger.fire('click');
  assert.equal(menu.classList.contains('open'), true);
  assert.equal(menu.trigger.getAttribute('aria-expanded'), 'true');
  menu.trigger.fire('click');
  assert.equal(menu.classList.contains('open'), false);
  assert.equal(menu.trigger.getAttribute('aria-expanded'), 'false');
});

test('outside click synchronizes expanded state without stealing focus', () => {
  const f = fixture();
  const menu = f.menus[0];
  menu.trigger.fire('click');
  f.body.fire('click');
  assert.equal(menu.classList.contains('open'), false);
  assert.equal(menu.trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(f.focused(), null);
});

test('resize synchronizes expanded state without stealing focus', () => {
  const f = fixture();
  const menu = f.menus[0];
  menu.trigger.fire('click');
  f.window.fire('resize');
  assert.equal(menu.classList.contains('open'), false);
  assert.equal(menu.trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(f.focused(), null);
});

test('switching menus synchronizes expanded state without stealing focus', () => {
  const f = fixture();
  const menu = f.menus[0];
  menu.trigger.fire('click');
  f.menus[1].trigger.fire('click');
  assert.equal(menu.classList.contains('open'), false);
  assert.equal(menu.trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(f.focused(), null);
});
