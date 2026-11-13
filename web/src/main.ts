import * as catalogView from './catalog-view.ts';
import * as supplierDetails from './detail-view.ts';
import * as supplierWrite from './write-view.ts';
import * as site from './data/site.ts';
import { start } from './app/app.ts';

void start({
  win: window,
  site,
  view: catalogView,
  details: supplierDetails,
  write: supplierWrite,
});
