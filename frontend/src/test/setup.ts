import '@testing-library/jest-dom/vitest';
import i18n from '../i18n/index.js';

// jsdom doesn't implement <dialog>'s modal behavior (showModal/close) —
// stub the two methods so components using the real element under test
// don't crash; the open/close *state* is still exercised via the `open`
// attribute the component itself manages.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
}
if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
}

// Real i18next, not a mock: tests assert on the actual German copy users
// see, so a typo in a locale file fails a test instead of silently
// shipping "form.title" to production.
beforeAll(async () => {
  if (!i18n.isInitialized) {
    await new Promise<void>((resolve) => i18n.on('initialized', () => resolve()));
  }
  await i18n.changeLanguage('de');
});
