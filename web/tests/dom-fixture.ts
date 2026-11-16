import { readFileSync } from 'node:fs';

import { JSDOM } from 'jsdom';

export function domFixture(url = 'https://example.test/app/') {
  const dom = new JSDOM(readFileSync('web/index.html', 'utf8'), { url });
  const { window } = dom;
  Object.assign(globalThis, {
    document: window.document,
    Option: window.Option as typeof Option,
    FormData: window.FormData,
  });
  window.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  const el = (selector: string): HTMLElement => {
    const node = window.document.querySelector<HTMLElement>(selector);
    if (!node) throw new Error(`Missing test element: ${selector}`);
    return node;
  };
  const close = () => {
    (el('#query') as HTMLInputElement).value = '';
    window.dispatchEvent(new window.Event('pagehide'));
    window.close();
  };
  return { window, win: window as unknown as Window, el, close };
}
