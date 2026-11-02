import { REGIONS, TOKENS, UPGRADES } from './config.mjs';
import { calculateDebtPressure } from './encounter-engine.mjs?v=b0dc5dd7953f63144bf23f758415762c';
import { inventoryUsed } from './game-engine.mjs?v=e854586b8cc351af9e608e0576aa1242';

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function formatMoney(value) {
  return currency.format(value);
}

function pressureLabel(value) {
  if (value >= 70) return 'HIGH';
  if (value >= 35) return 'MEDIUM';
  return 'LOW';
}

function lossReasonLabel(reason) {
  if (reason === 'health') return 'Health reached zero during an encounter.';
  if (reason === 'captured') return 'Your connection was captured during an encounter.';
  return 'The run was terminated.';
}

function formatPurchasePrice(value) {
  if (!Number.isFinite(value) || value <= 0) return '—';
  return Number.isInteger(value) ? formatMoney(value) : new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value);
}

export function createViewModel(state) {
  if (!state) return { view: 'setup', message: '' };
  const region = REGIONS.find(({ id }) => id === state.regionId);
  const pressure = calculateDebtPressure(state);
  const recoveredScore = state.status === 'lost' ? state.cash + state.savings : null;
  const view = state.status === 'completed'
    ? 'ending'
    : state.status === 'lost'
      ? 'loss'
      : state.pendingEncounter
        ? 'encounter'
        : 'market';

  return {
    view,
    day: `${state.day} / ${state.maxDays}`,
    regionId: state.regionId,
    marketPath: `token-wars://market/${state.regionId}`,
    region: region?.name ?? state.regionId,
    health: `${state.health} / 100`,
    cash: formatMoney(state.cash),
    savings: formatMoney(state.savings),
    debt: formatMoney(state.debt),
    pressure: pressureLabel(pressure),
    pressureValue: pressure,
    capacity: `${inventoryUsed(state)} / ${state.capacity}`,
    news: state.lastEvent?.text ?? 'No major market news yet.',
    message: state.lastMessage ?? '',
    eventKind: state.lastEvent?.kind ?? 'status',
    service: region?.service ?? null,
    tokens: TOKENS.map((token) => ({
      id: token.id,
      name: token.name,
      price: formatMoney(state.prices[token.id]),
      priceValue: state.prices[token.id],
      owned: state.holdings[token.id],
      averagePrice: state.holdings[token.id] > 0 ? formatPurchasePrice(state.averagePrices?.[token.id]) : '—',
    })),
    upgrades: state.upgrades.map((id) => UPGRADES.find((upgrade) => upgrade.id === id)).filter(Boolean),
    encounter: state.pendingEncounter,
    finalScore: state.finalScore == null
      ? recoveredScore == null ? null : formatMoney(recoveredScore)
      : formatMoney(state.finalScore),
    lossReason: lossReasonLabel(state.lossReason),
  };
}

function setField(root, field, value) {
  for (const element of root.querySelectorAll(`[data-tw-field="${field}"]`)) {
    element.textContent = value;
  }
}

export function renderGame(root, state, announcement = '', { outcome = null, selectedTokenId = 'llamas', encounterError = '' } = {}) {
  const model = createViewModel(state);
  if (outcome && model.view === 'market') {
    model.view = 'outcome';
    model.outcome = outcome;
  }
  root.dataset.twCurrentView = model.view;

  for (const view of root.querySelectorAll('[data-tw-view]')) {
    view.hidden = view.dataset.twView !== model.view;
  }
  for (const feedback of root.querySelectorAll('[data-tw-encounter-feedback]')) {
    feedback.textContent = model.view === 'encounter' ? encounterError : '';
    feedback.hidden = !feedback.textContent;
  }
  if (!state) return model;

  for (const field of ['day', 'region', 'health', 'cash', 'savings', 'debt', 'pressure', 'capacity', 'marketPath']) {
    setField(root, field, model[field]);
  }
  for (const element of root.querySelectorAll('[data-tw-compact]')) {
    const value = state[element.dataset.twCompact];
    element.textContent = value < 10000 ? formatMoney(value) : new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1,
    }).format(value);
    element.setAttribute('aria-label', formatMoney(value));
    element.setAttribute('title', formatMoney(value));
  }
  setField(root, 'message', announcement || model.message);
  setField(root, 'news', model.news);
  for (const feed of root.querySelectorAll('[data-tw-event-feed]')) {
    feed.dataset.eventKind = model.eventKind;
  }
  setField(
    root,
    'upgrades',
    model.upgrades.length > 0
      ? model.upgrades.map(({ name }) => name).join(' · ')
      : 'No upgrades installed yet.',
  );

  const tokenModels = new Map(model.tokens.map((token) => [token.id, token]));
  for (const row of root.querySelectorAll('[data-tw-token]')) {
    const token = tokenModels.get(row.dataset.twToken);
    if (!token) continue;
    const price = row.querySelector('[data-tw-token-field="price"]');
    const owned = row.querySelector('[data-tw-token-field="owned"]');
    if (price) price.textContent = token.price;
    if (owned) owned.textContent = String(token.owned);
    const selected = token.id === selectedTokenId;
    row.setAttribute('aria-current', selected ? 'true' : 'false');
    const selector = row.querySelector('[data-tw-action="select-token"]');
    if (selector) selector.setAttribute('aria-pressed', selected ? 'true' : 'false');
  }

  const selectedToken = tokenModels.get(selectedTokenId) ?? model.tokens[0];
  if (selectedToken) {
    const selectedFields = {
      name: selectedToken.name,
      price: selectedToken.price,
      owned: String(selectedToken.owned),
      averagePrice: selectedToken.averagePrice,
    };
    for (const [field, value] of Object.entries(selectedFields)) {
      for (const element of root.querySelectorAll(`[data-tw-selected-field="${field}"]`)) {
        element.textContent = value;
      }
    }
    for (const control of root.querySelectorAll('[data-tw-trade-token]')) {
      control.dataset.tokenId = selectedToken.id;
    }
    for (const input of root.querySelectorAll('[data-tw-trade-quantity]')) {
      input.dataset.twQuantity = selectedToken.id;
      input.setAttribute('aria-label', `Quantity of ${selectedToken.name}`);
    }
  }

  const serviceMessages = {
    bank: model.service === 'bank'
      ? 'EuroVault Bank is available in this region.'
      : 'EuroVault Bank is available in Europe.',
    lender: model.service === 'lender'
      ? 'CRED-I/O accepts repayments in this region.'
      : 'CRED-I/O accepts repayments in North America.',
  };
  for (const [service, message] of Object.entries(serviceMessages)) {
    const available = model.service === service;
    for (const element of root.querySelectorAll(`[data-tw-service-message="${service}"]`)) {
      element.textContent = message;
      element.dataset.available = String(available);
    }
    for (const control of root.querySelectorAll(`[data-tw-service-control="${service}"]`)) {
      control.disabled = !available;
    }
  }

  if (model.encounter) {
    for (const element of root.querySelectorAll('[data-tw-encounter-field="source"]')) {
      element.textContent = model.encounter.source;
    }
    for (const element of root.querySelectorAll('[data-tw-encounter-field="bribe"]')) {
      element.textContent = formatMoney(model.encounter.bribeCost);
    }
  }

  if (model.outcome) {
    for (const element of root.querySelectorAll('[data-tw-outcome-field="choice"]')) {
      element.textContent = model.outcome.choice === 'bribe' ? 'PAY' : model.outcome.choice.toUpperCase();
    }
    for (const element of root.querySelectorAll('[data-tw-outcome-field="message"]')) {
      element.textContent = model.outcome.message;
    }
  }

  if (model.finalScore) {
    for (const element of root.querySelectorAll('[data-tw-ending-field="score"]')) {
      element.textContent = model.finalScore;
    }
  }

  if (model.view === 'loss') {
    for (const element of root.querySelectorAll('[data-tw-loss-field="reason"]')) {
      element.textContent = model.lossReason;
    }
  }

  for (const button of root.querySelectorAll('[data-tw-action="travel"][data-region-id]')) {
    const destination = REGIONS.find(region => region.id === button.dataset.regionId);
    const service = destination?.service === 'bank' ? 'Bank' : destination?.service === 'lender' ? 'Loan shark' : '';
    button.setAttribute('aria-label', `${destination?.name ?? button.dataset.regionId}${service ? ` — ${service}` : ''}`);
    const label = button.querySelector?.('[data-tw-region-service]');
    if (label) label.textContent = service;
    const current = button.dataset.regionId === model.regionId;
    button.disabled = current;
    if (current) button.setAttribute('aria-current', 'location');
    else button.removeAttribute('aria-current');
  }

  return model;
}
