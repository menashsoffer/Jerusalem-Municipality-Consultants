import * as catalog from './catalog.ts';
import * as site from './data/site.ts';

declare global {
  interface Window {
    SupplierCatalog: typeof catalog;
    SiteData: typeof site;
  }
}

window.SupplierCatalog = Object.freeze({ ...catalog });
window.SiteData = Object.freeze({ ...site });

const legacyApp = document.createElement('script');
legacyApp.src = new URL('assets/app.js?v=12', document.baseURI).href;
document.head.append(legacyApp);
