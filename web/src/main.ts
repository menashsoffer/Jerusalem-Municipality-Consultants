import * as catalog from './catalog.ts';

declare global {
  interface Window {
    SupplierCatalog: typeof catalog;
  }
}

window.SupplierCatalog = Object.freeze({ ...catalog });

const legacyApp = document.createElement('script');
legacyApp.src = new URL('assets/app.js?v=11', document.baseURI).href;
document.head.append(legacyApp);
