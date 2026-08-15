import {
  buyToken,
  depositSavings,
  inventoryUsed,
  repayDebt,
  sellToken,
  startGame,
  travel,
  withdrawSavings,
} from './game-engine.mjs';
import { resolveEncounter } from './encounter-engine.mjs';
import { renderGame } from './ui.mjs';

export function maximumBuyQuantity(state, tokenId) {
  const price = state.prices?.[tokenId];
  if (!Number.isSafeInteger(price) || price <= 0) return 0;
  const affordable = Math.floor(state.cash / price);
  const remainingCapacity = Math.max(0, state.capacity - inventoryUsed(state));
  return Math.max(0, Math.min(affordable, remainingCapacity));
}

export function maximumSellQuantity(state, tokenId) {
  const owned = state.holdings?.[tokenId];
  return Number.isSafeInteger(owned) && owned > 0 ? owned : 0;
}

export function executeGameAction(state, action, payload = {}, { rng = Math.random } = {}) {
  switch (action) {
    case 'buy':
      return buyToken(state, payload.tokenId, payload.quantity);
    case 'sell':
      return sellToken(state, payload.tokenId, payload.quantity);
    case 'deposit':
      return depositSavings(state, payload.amount);
    case 'withdraw':
      return withdrawSavings(state, payload.amount);
    case 'repay':
      return repayDebt(state, payload.amount);
    case 'travel':
      return travel(state, payload.regionId, { rng });
    case 'encounter':
      return resolveEncounter(state, payload.choice, rng);
    default:
      return { ok: false, state, message: 'Unknown game action.' };
  }
}

export function createGameController({ rng = Math.random, render = () => {} } = {}) {
  let state = null;
  let outcome = null;

  return {
    start(days) {
      outcome = null;
      state = startGame(days, { rng });
      render(state, state.lastMessage);
      return state;
    },
    action(action, payload = {}) {
      if (!state) {
        const result = { ok: false, state, message: 'Start a run before using game controls.' };
        render(state, result.message);
        return result;
      }
      const result = executeGameAction(state, action, payload, { rng });
      if (result.ok) state = result.state;
      if (result.ok && action === 'encounter' && state.status === 'playing') {
        outcome = { choice: payload.choice, message: result.message };
      }
      render(state, result.message, { outcome });
      return result;
    },
    continueOutcome() {
      outcome = null;
      render(state, state?.lastMessage ?? '', { outcome });
    },
    playAgain() {
      state = null;
      outcome = null;
      render(null, '');
    },
    getState() {
      return state;
    },
  };
}

export function focusView(root, view) {
  const selectors = {
    setup: '[data-tw-view="setup"] [data-tw-action="start"]',
    market: '[data-tw-view="market"] h2',
    encounter: '[data-tw-view="encounter"] [data-tw-action="encounter"]',
    outcome: '[data-tw-view="outcome"] h2',
    ending: '[data-tw-view="ending"] h2',
    loss: '[data-tw-view="loss"] h2',
  };
  root.querySelector(selectors[view])?.focus();
}

export function mountGame(root, { rng = Math.random } = {}) {
  let currentView = 'setup';
  let selectedTokenId = 'llamas';
  const getDialog = (name) => root.querySelector(`[data-tw-dialog="${name}"]`);
  const showDialogFeedback = (name, visible) => {
    const feedback = getDialog(name)?.querySelector?.('[data-tw-dialog-feedback]');
    if (feedback) feedback.hidden = !visible;
  };
  const openDialog = (name) => {
    const dialog = getDialog(name);
    showDialogFeedback(name, false);
    if (dialog && !dialog.open) dialog.showModal();
  };
  const closeDialog = (name) => {
    const dialog = getDialog(name);
    if (dialog?.open) dialog.close();
  };
  const renderMountedGame = (state, message, options = {}) => {
    const model = renderGame(root, state, message, { ...options, selectedTokenId });
    if (model.view !== currentView) {
      currentView = model.view;
      focusView(root, currentView);
    }
    return model;
  };
  const controller = createGameController({
    rng,
    render: renderMountedGame,
  });
  const dispatchAndClose = (action, payload, dialog) => {
    const result = controller.action(action, payload);
    if (result.ok) closeDialog(dialog);
    else showDialogFeedback(dialog, true);
    return result;
  };

  root.addEventListener('click', (event) => {
    const control = event.target.closest('[data-tw-action]');
    if (!control) return;
    if (control.dataset.twAction === 'start') {
      selectedTokenId = 'llamas';
      const selected = root.querySelector('input[name="tw-run-length"]:checked');
      controller.start(Number(selected?.value ?? 60));
      return;
    }
    if (control.dataset.twAction === 'select-token') {
      selectedTokenId = control.dataset.tokenId;
      const state = controller.getState();
      if (state) {
        renderMountedGame(state, state.lastMessage);
        openDialog('trade');
      }
      return;
    }
    if (control.dataset.twAction === 'open-dialog') {
      openDialog(control.dataset.dialog);
      return;
    }
    if (control.dataset.twAction === 'close-dialog') {
      closeDialog(control.dataset.dialog);
      return;
    }
    if (control.dataset.twAction === 'buy') {
      const tokenId = control.dataset.tokenId;
      const input = root.querySelector(`[data-tw-quantity="${tokenId}"]`);
      dispatchAndClose('buy', { tokenId, quantity: Number(input?.value) }, 'trade');
      return;
    }
    if (control.dataset.twAction === 'sell') {
      const tokenId = control.dataset.tokenId;
      const input = root.querySelector(`[data-tw-quantity="${tokenId}"]`);
      dispatchAndClose('sell', { tokenId, quantity: Number(input?.value) }, 'trade');
      return;
    }
    if (control.dataset.twAction === 'max-buy') {
      const tokenId = control.dataset.tokenId;
      const state = controller.getState();
      if (state) dispatchAndClose('buy', { tokenId, quantity: maximumBuyQuantity(state, tokenId) }, 'trade');
      return;
    }
    if (control.dataset.twAction === 'max-sell') {
      const tokenId = control.dataset.tokenId;
      const state = controller.getState();
      if (state) dispatchAndClose('sell', { tokenId, quantity: maximumSellQuantity(state, tokenId) }, 'trade');
      return;
    }
    if (control.dataset.twAction === 'travel') {
      controller.action('travel', { regionId: control.dataset.regionId });
      return;
    }
    if (control.dataset.twAction === 'deposit' || control.dataset.twAction === 'withdraw') {
      const input = root.querySelector('#tw-bank-amount');
      dispatchAndClose(control.dataset.twAction, { amount: Number(input?.value) }, 'bank');
      return;
    }
    if (control.dataset.twAction === 'repay') {
      const input = root.querySelector('#tw-repayment-amount');
      dispatchAndClose('repay', { amount: Number(input?.value) }, 'debt');
      return;
    }
    if (control.dataset.twAction === 'encounter') {
      controller.action('encounter', { choice: control.dataset.choice });
      return;
    }
    if (control.dataset.twAction === 'continue-outcome') {
      controller.continueOutcome();
      return;
    }
    if (control.dataset.twAction === 'play-again') {
      controller.playAgain();
    }
  });

  renderGame(root, null);
  return controller;
}

export function startBrowserGame(documentRef, options = {}) {
  const root = documentRef.querySelector('[data-tw-game]');
  return root ? mountGame(root, options) : null;
}

if (typeof document !== 'undefined') {
  startBrowserGame(document);
}
