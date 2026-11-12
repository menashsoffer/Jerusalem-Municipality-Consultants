import * as catalog from './catalog.ts';
import * as catalogView from './catalog-view.ts';
import * as site from './data/site.ts';

declare global {
  interface Window {
    SupplierCatalog: typeof catalog;
    CatalogView: typeof catalogView;
    SiteData: typeof site;
  }
}

window.SupplierCatalog = Object.freeze({ ...catalog });
window.CatalogView = Object.freeze({ ...catalogView });
window.SiteData = Object.freeze({ ...site });

const legacyApp = document.createElement('script');
legacyApp.src = new URL('assets/app.js?v=13', document.baseURI).href;
document.head.append(legacyApp);
