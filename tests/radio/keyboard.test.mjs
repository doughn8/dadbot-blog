import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Run the production keybind block, isolating only media/network dependencies.
const source = readFileSync(new URL('../../static/radio/radio.mjs', import.meta.url), 'utf8');
const start = source.indexOf('  // --- keybinds');
const end = source.indexOf('  // --- boot', start);
assert.ok(start >= 0 && end > start, 'production keyboard section must exist');

function target(selector = '', parent = null) {
  return {
    focus() { this.focused = true; },
    blur() { this.blurred = true; },
    closest(selectors) { return selectors.split(',').map((s) => s.trim()).includes(selector) ? this : parent?.closest(selectors) || null; },
  };
}

function fixture(active = target()) {
  let handler;
  const actions = [];
  const filterInput = target('input');
  const volumeInput = { value: '50' };
  const document = { activeElement: active, addEventListener(name, fn) { assert.equal(name, 'keydown'); handler = fn; } };
  const context = {
    document, filterInput, volumeInput, audio: { volume: 0.5 },
    visible: [{ id: 'a' }, { id: 'b' }], selected: 0, listEl: null,
    renderList: () => actions.push('select'), pauseToggle: () => actions.push('pause'),
    tune: (station) => actions.push(`tune:${station.id}`), hifiBtn: { click: () => actions.push('hifi') },
  };
  vm.runInNewContext(source.slice(start, end), context);
  return {
    actions, filterInput, volumeInput, context,
    key(key, props = {}) {
      const event = { key, target: document.activeElement, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...props };
      handler(event);
      return event;
    },
  };
}

test('Space in the weather input is not cancelled or sent to the radio', () => {
  const f = fixture(target('input'));
  assert.equal(f.key(' ').defaultPrevented, false);
  assert.deepEqual(f.actions, []);
});

for (const selector of ['a[href]', 'button', 'select', 'textarea', 'summary', '[contenteditable]', '[role="combobox"]', '[role="listbox"]', '[role="option"]', '[role="button"]', '[role="slider"]']) {
  test(`keys on ${selector} and its descendants remain owned by that control`, () => {
    const f = fixture(target('', target(selector)));
    for (const key of [' ', 'Enter', 'ArrowDown', 'ArrowUp', '/', '+', '-', 'h']) {
      assert.equal(f.key(key).defaultPrevented, false, key);
    }
    assert.deepEqual(f.actions, []);
    assert.equal(f.volumeInput.value, '50');
    assert.equal(f.filterInput.focused, undefined);
  });
}

for (const flag of ['defaultPrevented', 'isComposing', 'ctrlKey', 'metaKey', 'altKey']) {
  test(`${flag} prevents radio shortcut dispatch`, () => {
    const f = fixture();
    const event = f.key(' ', { [flag]: true });
    assert.deepEqual(f.actions, []);
    assert.equal(event.defaultPrevented, flag === 'defaultPrevented');
  });
}

test('background radio shortcuts retain their intended actions', () => {
  const f = fixture();
  for (const key of [' ', 'ArrowDown', 'ArrowUp', 'Enter', 'h']) assert.equal(f.key(key).defaultPrevented, key !== 'h');
  assert.deepEqual(f.actions, ['pause', 'select', 'select', 'tune:a', 'hifi']);
  f.key('+'); assert.equal(f.volumeInput.value, '55');
  f.key('-'); assert.equal(f.volumeInput.value, '50');
  f.key('/'); assert.equal(f.filterInput.focused, true);
});

test('radio filter keeps typing private and Escape blurs it', () => {
  const f = fixture();
  f.context.document.activeElement = f.filterInput;
  for (const key of [' ', 'Enter', '/', 'h']) assert.equal(f.key(key).defaultPrevented, false);
  assert.deepEqual(f.actions, []);
  f.key('Escape'); assert.equal(f.filterInput.blurred, true);
});

test('radio module uses a content hash so keyboard fixes bypass stale caches', () => {
  const template = readFileSync(new URL('../../layouts/radio/list.html', import.meta.url), 'utf8');
  assert.match(template, /radio\/radio\.mjs" \| relURL \}\}\?v=\{\{ md5 \(readFile "static\/radio\/radio\.mjs"\) \}\}/);
});
