import test from 'node:test';
import assert from 'node:assert/strict';

import { TOKENS } from '../../static/games/token-wars/js/config.mjs';
import { startGame } from '../../static/games/token-wars/js/game-engine.mjs';
import { createSeededRandom } from '../../static/games/token-wars/js/random.mjs';
import { createViewModel, renderGame } from '../../static/games/token-wars/js/ui.mjs';
import {
  createGameController,
  executeGameAction,
  focusView,
  maximumBuyQuantity,
  mountGame,
  startBrowserGame,
} from '../../static/games/token-wars/js/main.mjs';

test('createViewModel maps a fresh engine state into the complete market display model', () => {
  const state = startGame(30, { rng: createSeededRandom(101) });
  const model = createViewModel(state);

  assert.equal(model.view, 'market');
  assert.equal(model.day, '1 / 30');
  assert.equal(model.marketPath, `token-wars://market/${state.regionId}`);
  assert.equal(model.cash, '$2,000');
  assert.equal(model.debt, '$5,500');
  assert.equal(model.health, '100 / 100');
  assert.equal(model.capacity, '0 / 100');
  assert.equal(model.tokens.length, TOKENS.length);
  assert.deepEqual(model.tokens.map(({ id }) => id), TOKENS.map(({ id }) => id));
  assert.ok(model.tokens.every(({ owned }) => owned === 0));
  assert.match(model.message, /Market feed online/);
});

test('createViewModel labels prices relative to each token typical value', () => {
  const original = startGame(30, { rng: createSeededRandom(201) });
  const state = {
    ...original,
    prices: {
      ...original.prices,
      llamas: 10,
      mistrals: 110,
      gpts: 55000,
    },
  };

  const model = createViewModel(state);
  const byId = new Map(model.tokens.map((token) => [token.id, token]));

  assert.deepEqual(
    [byId.get('llamas').signal, byId.get('mistrals').signal, byId.get('gpts').signal],
    ['low', 'mid', 'high'],
  );
  assert.deepEqual(
    [byId.get('llamas').signalLabel, byId.get('mistrals').signalLabel, byId.get('gpts').signalLabel],
    ['LOW · BUY ZONE', 'MID · WATCH', 'HIGH · SELL ZONE'],
  );
});

test('createViewModel keeps event news separate from later action feedback', () => {
  const original = startGame(30, { rng: createSeededRandom(203) });
  const state = {
    ...original,
    lastEvent: { id: 'gpt-model-release', kind: 'market', text: 'GPT prices are sky high.' },
    lastMessage: 'Bought 2 LLaMAs for $40.',
  };

  const model = createViewModel(state);

  assert.equal(model.news, 'GPT prices are sky high.');
  assert.equal(model.message, 'Bought 2 LLaMAs for $40.');
  assert.equal(model.eventKind, 'market');
});

test('executeGameAction delegates trading to the engine and preserves rejection explanations', () => {
  const original = startGame(30, { rng: createSeededRandom(102) });
  const state = { ...original, prices: { ...original.prices, llamas: 100 } };

  const bought = executeGameAction(state, 'buy', { tokenId: 'llamas', quantity: 2 });
  const rejected = executeGameAction(bought.state, 'sell', { tokenId: 'llamas', quantity: 3 });

  assert.equal(bought.ok, true);
  assert.equal(bought.state.cash, 1800);
  assert.equal(bought.state.holdings.llamas, 2);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.state, bought.state);
  assert.match(rejected.message, /Not enough LLaMAs to sell/);
});

test('executeGameAction wires bank and lender actions through their regional engine rules', () => {
  const original = startGame(30, { rng: createSeededRandom(103) });
  const europe = { ...original, regionId: 'europe' };
  const deposited = executeGameAction(europe, 'deposit', { amount: 500 });
  const withdrawn = executeGameAction(deposited.state, 'withdraw', { amount: 200 });
  const northAmerica = { ...withdrawn.state, regionId: 'north-america' };
  const repaid = executeGameAction(northAmerica, 'repay', { amount: 300 });

  assert.deepEqual(
    [deposited.ok, withdrawn.ok, repaid.ok],
    [true, true, true],
  );
  assert.equal(repaid.state.cash, 1400);
  assert.equal(repaid.state.savings, 300);
  assert.equal(repaid.state.debt, 5200);
  assert.match(repaid.message, /Repaid \$300/);
});

test('executeGameAction wires VPN travel with the controller RNG', () => {
  const original = startGame(30, { rng: createSeededRandom(104) });
  const state = { ...original, regionId: 'asia' };
  const result = executeGameAction(
    state,
    'travel',
    { regionId: 'europe' },
    { rng: () => 0.5 },
  );

  assert.equal(result.ok, true);
  assert.equal(result.state.regionId, 'europe');
  assert.equal(result.state.day, 2);
  assert.match(result.message, /VPN jump complete/);
});

test('executeGameAction resolves an active encounter through the encounter engine', () => {
  const original = startGame(30, { rng: createSeededRandom(105) });
  const state = {
    ...original,
    cash: 1000,
    pendingEncounter: {
      id: 'test-encounter',
      source: 'Rival hackers',
      pressure: 20,
      bribeCost: 300,
      damage: 20,
      reward: 400,
    },
  };
  const result = executeGameAction(
    state,
    'encounter',
    { choice: 'bribe' },
    { rng: () => 0.5 },
  );

  assert.equal(result.ok, true);
  assert.equal(result.state.cash, 700);
  assert.equal(result.state.pendingEncounter, null);
  assert.match(result.message, /connection is clear/);
});

test('maximumBuyQuantity respects both cash and remaining secure-server capacity', () => {
  const original = startGame(30, { rng: createSeededRandom(106) });
  const cashLimited = { ...original, cash: 450, prices: { ...original.prices, llamas: 100 } };
  const capacityLimited = {
    ...original,
    cash: 100000,
    prices: { ...original.prices, llamas: 100 },
    holdings: { ...original.holdings, mistrals: 98 },
  };

  assert.equal(maximumBuyQuantity(cashLimited, 'llamas'), 4);
  assert.equal(maximumBuyQuantity(capacityLimited, 'llamas'), 2);
});

test('createGameController owns one in-memory state and renders start, action, and reset transitions', () => {
  const rendered = [];
  const controller = createGameController({
    rng: createSeededRandom(107),
    render: (state, message) => rendered.push({ state, message }),
  });

  const started = controller.start(30);
  const bought = controller.action('buy', { tokenId: 'llamas', quantity: 1 });
  controller.playAgain();

  assert.equal(started.status, 'playing');
  assert.equal(bought.ok, true);
  assert.equal(rendered[0].state, started);
  assert.equal(rendered[1].state, bought.state);
  assert.equal(rendered.at(-1).state, null);
  assert.equal(controller.getState(), null);
});

class FakeElement {
  constructor(dataset = {}) {
    this.dataset = dataset;
    this.hidden = false;
    this.disabled = false;
    this.textContent = '';
    this.attributes = new Map();
    this.children = new Map();
  }
  querySelector(selector) { return this.children.get(selector) ?? null; }
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
}

function createFakeGameRoot() {
  const views = ['setup', 'market', 'encounter', 'outcome', 'ending', 'loss'].map((view) => new FakeElement({ twView: view }));
  const fields = Object.fromEntries(
    ['day', 'region', 'health', 'cash', 'savings', 'debt', 'pressure', 'capacity', 'marketPath', 'news', 'message']
      .map((field) => [field, [new FakeElement()]]),
  );
  const tokenRows = TOKENS.map((token) => {
    const row = new FakeElement({ twToken: token.id });
    row.children.set('[data-tw-token-field="price"]', new FakeElement());
    row.children.set('[data-tw-token-field="owned"]', new FakeElement());
    row.children.set('[data-tw-token-field="signal"]', new FakeElement());
    row.children.set('[data-tw-action="select-token"]', new FakeElement({ tokenId: token.id }));
    return row;
  });
  const travelButtons = ['north-america', 'south-america', 'europe', 'africa', 'asia', 'oceania']
    .map((regionId) => new FakeElement({ regionId }));
  const serviceMessages = Object.fromEntries(['bank', 'lender'].map((service) => [service, new FakeElement()]));
  const serviceControls = Object.fromEntries(['bank', 'lender'].map((service) => [service, [new FakeElement(), new FakeElement()]]));
  const special = {
    '[data-tw-encounter-field="source"]': [new FakeElement()],
    '[data-tw-encounter-field="bribe"]': [new FakeElement()],
    '[data-tw-ending-field="score"]': [new FakeElement()],
    '[data-tw-loss-field="reason"]': [new FakeElement()],
    '[data-tw-outcome-field="choice"]': [new FakeElement()],
    '[data-tw-outcome-field="message"]': [new FakeElement()],
    '[data-tw-field="upgrades"]': [new FakeElement()],
    '[data-tw-event-feed]': [new FakeElement()],
    '[data-tw-selected-field="name"]': [new FakeElement()],
    '[data-tw-selected-field="price"]': [new FakeElement()],
    '[data-tw-selected-field="owned"]': [new FakeElement()],
    '[data-tw-selected-field="signal"]': [new FakeElement()],
    '[data-tw-trade-token]': [new FakeElement(), new FakeElement(), new FakeElement(), new FakeElement()],
    '[data-tw-trade-quantity]': [new FakeElement()],
  };

  const root = {
    dataset: {},
    querySelectorAll(selector) {
      if (selector === '[data-tw-view]') return views;
      if (selector === '[data-tw-token]') return tokenRows;
      if (selector === '[data-tw-action="travel"][data-region-id]') return travelButtons;
      const serviceMessage = selector.match(/^\[data-tw-service-message="([^"]+)"\]$/)?.[1];
      if (serviceMessage) return [serviceMessages[serviceMessage]];
      const serviceControl = selector.match(/^\[data-tw-service-control="([^"]+)"\]$/)?.[1];
      if (serviceControl) return serviceControls[serviceControl];
      if (special[selector]) return special[selector];
      const field = selector.match(/^\[data-tw-field="([^"]+)"\]$/)?.[1];
      return field ? fields[field] : [];
    },
  };
  return { root, views, fields, tokenRows, travelButtons, serviceMessages, serviceControls, special };
}

function clickTarget(dataset) {
  return { closest: () => ({ dataset }) };
}

test('mountGame starts the selected run through the real delegated Start action', () => {
  const dom = createFakeGameRoot();
  const listeners = {};
  let focused = null;
  dom.root.addEventListener = (type, listener) => { listeners[type] = listener; };
  dom.root.querySelector = (selector) => {
    if (selector === 'input[name="tw-run-length"]:checked') return { value: '30' };
    if (selector === '[data-tw-view="market"] h2') return { focus: () => { focused = 'market'; } };
    return null;
  };

  const controller = mountGame(dom.root, { rng: createSeededRandom(113) });
  listeners.click({ target: clickTarget({ twAction: 'start' }) });

  assert.equal(controller.getState().maxDays, 30);
  assert.equal(dom.views.find((view) => view.dataset.twView === 'market').hidden, false);
  assert.equal(dom.fields.day[0].textContent, '1 / 30');
  assert.equal(focused, 'market');
});

test('mountGame sends token quantities through delegated trading actions', () => {
  const dom = createFakeGameRoot();
  const listeners = {};
  dom.root.addEventListener = (type, listener) => { listeners[type] = listener; };
  dom.root.querySelector = (selector) => {
    if (selector === 'input[name="tw-run-length"]:checked') return { value: '30' };
    if (selector === '[data-tw-quantity="llamas"]') return { value: '2' };
    return null;
  };

  const controller = mountGame(dom.root, { rng: createSeededRandom(114) });
  listeners.click({ target: clickTarget({ twAction: 'start' }) });
  listeners.click({ target: clickTarget({ twAction: 'buy', tokenId: 'llamas' }) });

  assert.equal(controller.getState().holdings.llamas, 2);
  assert.equal(
    dom.tokenRows[0].children.get('[data-tw-token-field="owned"]').textContent,
    '2',
  );

  listeners.click({ target: clickTarget({ twAction: 'sell', tokenId: 'llamas' }) });
  assert.equal(controller.getState().holdings.llamas, 0);
});

test('mountGame selects one token and opens the shared trade dialog', () => {
  const dom = createFakeGameRoot();
  const listeners = {};
  const tradeDialog = { open: false, showModal() { this.open = true; }, close() { this.open = false; } };
  dom.root.addEventListener = (type, listener) => { listeners[type] = listener; };
  dom.root.querySelector = (selector) => {
    if (selector === 'input[name="tw-run-length"]:checked') return { value: '30' };
    if (selector === '[data-tw-dialog="trade"]') return tradeDialog;
    return null;
  };

  mountGame(dom.root, { rng: createSeededRandom(204) });
  listeners.click({ target: clickTarget({ twAction: 'start' }) });
  listeners.click({ target: clickTarget({ twAction: 'select-token', tokenId: 'gpts' }) });

  assert.equal(dom.special['[data-tw-selected-field="name"]'][0].textContent, 'GPTs');
  assert.ok(dom.special['[data-tw-trade-token]'].every((control) => control.dataset.tokenId === 'gpts'));
  assert.equal(tradeDialog.open, true);
});

test('mountGame keeps a transaction dialog open when its engine action is rejected', () => {
  const dom = createFakeGameRoot();
  const listeners = {};
  const feedback = { hidden: true };
  const tradeDialog = {
    open: false,
    showModal() { this.open = true; },
    close() { this.open = false; },
    querySelector(selector) { return selector === '[data-tw-dialog-feedback]' ? feedback : null; },
  };
  dom.root.addEventListener = (type, listener) => { listeners[type] = listener; };
  dom.root.querySelector = (selector) => {
    if (selector === 'input[name="tw-run-length"]:checked') return { value: '30' };
    if (selector === '[data-tw-dialog="trade"]') return tradeDialog;
    if (selector === '[data-tw-quantity="llamas"]') return { value: '999999' };
    return null;
  };

  mountGame(dom.root, { rng: createSeededRandom(206) });
  listeners.click({ target: clickTarget({ twAction: 'start' }) });
  listeners.click({ target: clickTarget({ twAction: 'select-token', tokenId: 'llamas' }) });
  listeners.click({ target: clickTarget({ twAction: 'buy', tokenId: 'llamas' }) });

  assert.equal(tradeDialog.open, true);
  assert.equal(feedback.hidden, false);
  assert.match(dom.fields.message[0].textContent, /cash|capacity/i);
});

test('mountGame opens and closes account dialogs without changing engine state', () => {
  const dom = createFakeGameRoot();
  const listeners = {};
  const dialogs = Object.fromEntries(['bank', 'debt', 'health'].map((name) => [name, {
    open: false,
    showModal() { this.open = true; },
    close() { this.open = false; },
  }]));
  dom.root.addEventListener = (type, listener) => { listeners[type] = listener; };
  dom.root.querySelector = (selector) => {
    if (selector === 'input[name="tw-run-length"]:checked') return { value: '30' };
    const dialog = selector.match(/^\[data-tw-dialog="([^"]+)"\]$/)?.[1];
    return dialog ? dialogs[dialog] : null;
  };

  const controller = mountGame(dom.root, { rng: createSeededRandom(205) });
  listeners.click({ target: clickTarget({ twAction: 'start' }) });
  const state = controller.getState();
  listeners.click({ target: clickTarget({ twAction: 'open-dialog', dialog: 'bank' }) });
  assert.equal(dialogs.bank.open, true);
  assert.equal(controller.getState(), state);
  listeners.click({ target: clickTarget({ twAction: 'close-dialog', dialog: 'bank' }) });
  assert.equal(dialogs.bank.open, false);
  assert.equal(controller.getState(), state);
});

test('mountGame performs one-click Max Buy and Max Sell through engine trading actions', () => {
  const dom = createFakeGameRoot();
  const listeners = {};
  dom.root.addEventListener = (type, listener) => { listeners[type] = listener; };
  dom.root.querySelector = (selector) => (
    selector === 'input[name="tw-run-length"]:checked' ? { value: '30' } : null
  );

  const controller = mountGame(dom.root, { rng: createSeededRandom(115) });
  listeners.click({ target: clickTarget({ twAction: 'start' }) });
  const expected = maximumBuyQuantity(controller.getState(), 'llamas');

  listeners.click({ target: clickTarget({ twAction: 'max-buy', tokenId: 'llamas' }) });
  assert.equal(controller.getState().holdings.llamas, expected);

  listeners.click({ target: clickTarget({ twAction: 'max-sell', tokenId: 'llamas' }) });
  assert.equal(controller.getState().holdings.llamas, 0);
});

test('mountGame routes regional buttons through the travel engine action', () => {
  const dom = createFakeGameRoot();
  const listeners = {};
  dom.root.addEventListener = (type, listener) => { listeners[type] = listener; };
  dom.root.querySelector = (selector) => (
    selector === 'input[name="tw-run-length"]:checked' ? { value: '30' } : null
  );

  const controller = mountGame(dom.root, { rng: () => 0.5 });
  listeners.click({ target: clickTarget({ twAction: 'start' }) });
  const target = controller.getState().regionId === 'europe' ? 'asia' : 'europe';
  listeners.click({ target: clickTarget({ twAction: 'travel', regionId: target }) });

  assert.equal(controller.getState().regionId, target);
  assert.equal(controller.getState().day, 2);
});

test('mountGame wires the Europe bank controls to their labelled amount', () => {
  const dom = createFakeGameRoot();
  const listeners = {};
  const bankAmount = { value: '200' };
  dom.root.addEventListener = (type, listener) => { listeners[type] = listener; };
  dom.root.querySelector = (selector) => {
    if (selector === 'input[name="tw-run-length"]:checked') return { value: '30' };
    if (selector === '#tw-bank-amount') return bankAmount;
    return null;
  };

  const controller = mountGame(dom.root, { rng: () => 0.5 });
  listeners.click({ target: clickTarget({ twAction: 'start' }) });
  if (controller.getState().regionId !== 'europe') {
    listeners.click({ target: clickTarget({ twAction: 'travel', regionId: 'europe' }) });
  }
  const originalCash = controller.getState().cash;
  listeners.click({ target: clickTarget({ twAction: 'deposit' }) });
  assert.equal(controller.getState().cash, originalCash - 200);
  assert.equal(controller.getState().savings, 200);
  listeners.click({ target: clickTarget({ twAction: 'withdraw' }) });
  assert.equal(controller.getState().cash, originalCash);
  assert.equal(controller.getState().savings, 0);
});

test('mountGame wires debt repayment to the lender amount', () => {
  const dom = createFakeGameRoot();
  const listeners = {};
  const repayment = { value: '300' };
  dom.root.addEventListener = (type, listener) => { listeners[type] = listener; };
  dom.root.querySelector = (selector) => {
    if (selector === 'input[name="tw-run-length"]:checked') return { value: '30' };
    if (selector === '#tw-repayment-amount') return repayment;
    return null;
  };

  const controller = mountGame(dom.root, { rng: () => 0.5 });
  listeners.click({ target: clickTarget({ twAction: 'start' }) });
  if (controller.getState().regionId !== 'north-america') {
    listeners.click({ target: clickTarget({ twAction: 'travel', regionId: 'north-america' }) });
  }
  const originalDebt = controller.getState().debt;
  const originalCash = controller.getState().cash;
  listeners.click({ target: clickTarget({ twAction: 'repay' }) });

  assert.equal(controller.getState().debt, originalDebt - 300);
  assert.equal(controller.getState().cash, originalCash - 300);
});

test('mountGame shows an explicit encounter outcome until Continue is chosen', () => {
  const dom = createFakeGameRoot();
  const listeners = {};
  dom.root.addEventListener = (type, listener) => { listeners[type] = listener; };
  dom.root.querySelector = (selector) => (
    selector === 'input[name="tw-run-length"]:checked' ? { value: '30' } : null
  );

  const controller = mountGame(dom.root, { rng: () => 0.5 });
  listeners.click({ target: clickTarget({ twAction: 'start' }) });
  const state = controller.getState();
  state.cash = 1000;
  state.pendingEncounter = {
    id: 'test-encounter',
    source: 'Rival hackers',
    pressure: 20,
    bribeCost: 300,
    damage: 20,
    reward: 400,
  };

  listeners.click({ target: clickTarget({ twAction: 'encounter', choice: 'bribe' }) });

  assert.equal(controller.getState().cash, 700);
  assert.equal(controller.getState().pendingEncounter, null);
  assert.equal(dom.views.find((view) => view.dataset.twView === 'outcome').hidden, false);
  assert.equal(dom.special['[data-tw-outcome-field="choice"]'][0].textContent, 'PAY');
  assert.match(dom.special['[data-tw-outcome-field="message"]'][0].textContent, /Paid \$300/);

  listeners.click({ target: clickTarget({ twAction: 'continue-outcome' }) });
  assert.equal(dom.views.find((view) => view.dataset.twView === 'market').hidden, false);
});

test('mountGame resets an in-memory run through Play Again', () => {
  const dom = createFakeGameRoot();
  const listeners = {};
  dom.root.addEventListener = (type, listener) => { listeners[type] = listener; };
  dom.root.querySelector = (selector) => (
    selector === 'input[name="tw-run-length"]:checked' ? { value: '30' } : null
  );

  const controller = mountGame(dom.root, { rng: createSeededRandom(116) });
  listeners.click({ target: clickTarget({ twAction: 'start' }) });
  listeners.click({ target: clickTarget({ twAction: 'play-again' }) });

  assert.equal(controller.getState(), null);
  assert.equal(dom.views.find((view) => view.dataset.twView === 'setup').hidden, false);
});

test('startBrowserGame mounts the Token Wars root when the module loads in a browser', () => {
  const dom = createFakeGameRoot();
  dom.root.addEventListener = () => {};
  dom.root.querySelector = () => null;
  const documentRef = {
    querySelector: (selector) => (selector === '[data-tw-game]' ? dom.root : null),
  };

  const controller = startBrowserGame(documentRef, { rng: createSeededRandom(117) });

  assert.ok(controller);
  assert.equal(controller.getState(), null);
  assert.equal(dom.views.find((view) => view.dataset.twView === 'setup').hidden, false);
});

test('focusView moves keyboard focus to the primary control or heading for each view', () => {
  const focused = [];
  const elements = new Map([
    ['[data-tw-view="setup"] [data-tw-action="start"]', { focus: () => focused.push('setup') }],
    ['[data-tw-view="market"] h2', { focus: () => focused.push('market') }],
    ['[data-tw-view="encounter"] [data-tw-action="encounter"]', { focus: () => focused.push('encounter') }],
    ['[data-tw-view="outcome"] h2', { focus: () => focused.push('outcome') }],
    ['[data-tw-view="ending"] h2', { focus: () => focused.push('ending') }],
    ['[data-tw-view="loss"] h2', { focus: () => focused.push('loss') }],
  ]);
  const root = { querySelector: (selector) => elements.get(selector) ?? null };

  for (const view of ['market', 'encounter', 'outcome', 'ending', 'loss', 'setup']) focusView(root, view);

  assert.deepEqual(focused, ['market', 'encounter', 'outcome', 'ending', 'loss', 'setup']);
});

test('renderGame applies one engine state to views, fields, popup services, and travel controls', () => {
  const original = startGame(30, { rng: createSeededRandom(108) });
  const state = { ...original, regionId: 'asia' };
  const dom = createFakeGameRoot();

  renderGame(dom.root, state, 'Browser adapter online.');

  assert.equal(dom.root.dataset.twCurrentView, 'market');
  assert.equal(dom.views.find((view) => view.dataset.twView === 'market').hidden, false);
  assert.equal(dom.views.find((view) => view.dataset.twView === 'setup').hidden, true);
  assert.equal(dom.fields.day[0].textContent, '1 / 30');
  assert.equal(dom.fields.region[0].textContent, 'Asia');
  assert.equal(dom.fields.marketPath[0].textContent, 'token-wars://market/asia');
  assert.equal(dom.fields.message[0].textContent, 'Browser adapter online.');
  assert.equal(dom.fields.news[0].textContent, 'No major market news yet.');
  assert.equal(dom.tokenRows[0].children.get('[data-tw-token-field="owned"]').textContent, '0');
  assert.match(dom.tokenRows[0].children.get('[data-tw-token-field="signal"]').textContent, /ZONE|WATCH/);
  assert.equal(dom.serviceControls.bank.every((control) => control.disabled), true);
  assert.equal(dom.serviceControls.lender.every((control) => control.disabled), true);
  assert.match(dom.serviceMessages.bank.textContent, /available in Europe/);
  assert.match(dom.serviceMessages.lender.textContent, /North America/);
  const asia = dom.travelButtons.find((button) => button.dataset.regionId === 'asia');
  assert.equal(asia.disabled, true);
  assert.equal(asia.getAttribute('aria-current'), 'location');
});

test('renderGame marks the selected row and populates the shared trade dialog', () => {
  const state = startGame(30, { rng: createSeededRandom(205) });
  const dom = createFakeGameRoot();

  renderGame(dom.root, state, '', { selectedTokenId: 'gpts' });

  const gpts = dom.tokenRows.find((row) => row.dataset.twToken === 'gpts');
  assert.equal(gpts.getAttribute('aria-current'), 'true');
  assert.equal(dom.special['[data-tw-selected-field="name"]'][0].textContent, 'GPTs');
  assert.equal(dom.special['[data-tw-selected-field="owned"]'][0].textContent, '0');
  assert.ok(dom.special['[data-tw-trade-token]'].every((control) => control.dataset.tokenId === 'gpts'));
  assert.equal(dom.special['[data-tw-trade-quantity]'][0].dataset.twQuantity, 'gpts');
});

test('renderGame presents an active encounter from engine state', () => {
  const original = startGame(30, { rng: createSeededRandom(109) });
  const state = {
    ...original,
    pendingEncounter: {
      id: 'rival-hackers-2',
      source: 'Rival hackers',
      pressure: 25,
      bribeCost: 350,
      damage: 18,
      reward: 240,
    },
  };
  const dom = createFakeGameRoot();

  renderGame(dom.root, state);

  assert.equal(dom.views.find((view) => view.dataset.twView === 'encounter').hidden, false);
  assert.equal(dom.special['[data-tw-encounter-field="source"]'][0].textContent, 'Rival hackers');
  assert.equal(dom.special['[data-tw-encounter-field="bribe"]'][0].textContent, '$350');
});

test('renderGame presents the engine final score for a completed run', () => {
  const original = startGame(30, { rng: createSeededRandom(110) });
  const state = { ...original, status: 'completed', finalScore: 12345, lastMessage: 'Time expired.' };
  const dom = createFakeGameRoot();

  renderGame(dom.root, state);

  assert.equal(dom.views.find((view) => view.dataset.twView === 'ending').hidden, false);
  assert.equal(dom.special['[data-tw-ending-field="score"]'][0].textContent, '$12,345');
});

test('renderGame explains why a lost run ended', () => {
  const original = startGame(30, { rng: createSeededRandom(111) });
  const state = {
    ...original,
    health: 0,
    status: 'lost',
    lossReason: 'health',
    lastMessage: 'Your health reached zero. Connection terminated.',
  };
  const dom = createFakeGameRoot();

  renderGame(dom.root, state);

  assert.equal(dom.views.find((view) => view.dataset.twView === 'loss').hidden, false);
  assert.equal(
    dom.special['[data-tw-loss-field="reason"]'][0].textContent,
    'Health reached zero during an encounter.',
  );
  assert.equal(dom.special['[data-tw-ending-field="score"]'][0].textContent, '$2,000');
});

test('renderGame lists upgrades earned by the engine', () => {
  const original = startGame(30, { rng: createSeededRandom(112) });
  const state = { ...original, upgrades: ['ghost-vpn', 'server-rack'] };
  const dom = createFakeGameRoot();

  renderGame(dom.root, state);

  assert.equal(dom.special['[data-tw-field="upgrades"]'][0].textContent, 'Ghost VPN · Server Rack');
});

test('renderGame differentiates generated events in the live feed', () => {
  const original = startGame(30, { rng: createSeededRandom(118) });
  const state = {
    ...original,
    lastEvent: {
      id: 'bug-bounty',
      kind: 'bonus',
      text: 'A bug bounty pays before Legal changes its mind.',
      effect: { type: 'cash-delta', amount: 500 },
    },
    lastMessage: 'A bug bounty pays before Legal changes its mind.',
  };
  const dom = createFakeGameRoot();

  renderGame(dom.root, state);

  assert.equal(dom.special['[data-tw-event-feed]'][0].dataset.eventKind, 'bonus');
  assert.equal(dom.fields.message[0].textContent, state.lastMessage);
});
