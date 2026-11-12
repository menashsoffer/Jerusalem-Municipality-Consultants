import { filterCatalog, type Filters } from './catalog-filter.ts';
import { validity, type Membership, type Supplier, type Validity } from './catalog-model.ts';

let suppliers: Supplier[] = [];
let openSupplier: ((id: string) => void) | null = null;

export function setOpenHandler(handler: (id: string) => void): void {
  openSupplier = handler;
}
function el(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element ${id}`);
  return element;
}
function select(id: string): HTMLSelectElement {
  return el(id) as HTMLSelectElement;
}
function element(tag: string, text: string, cls?: string): HTMLElement {
  const node = document.createElement(tag);
  node.textContent = text;
  if (cls) node.className = cls;
  return node;
}
function today(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
function filters(): Filters {
  return {
    query: (el('query') as HTMLInputElement).value,
    registry: select('registry').value,
    field: select('field-filter').value,
    unit: select('unit-filter').value,
    validity: select('validity-filter').value as Validity | '',
    today: today(),
  };
}
function populate(id: string, label: string, options: Map<string, string>): void {
  const node = select(id);
  const previous = node.value;
  node.replaceChildren(new Option(label, ''));
  [...options]
    .sort((a, b) => a[1].localeCompare(b[1], 'he'))
    .forEach(([value, text]) => {
      node.add(new Option(text, value));
    });
  node.value = options.has(previous) ? previous : '';
}
export function options(): void {
  const members = suppliers.flatMap((supplier) => supplier.memberships);
  populate('registry', 'כל המאגרים', new Map(members.map((m) => [m.registryId, m.registry])));
  const registry = select('registry').value;
  const visible = members.filter((m) => !registry || m.registryId === registry);
  const fields = visible
    .filter((m) => m.fieldId !== null && m.field)
    .map((m): [string, string] => [m.fieldId ?? '', m.field]);
  const units = visible
    .filter((m) => m.unitId !== null && m.unit)
    .map((m): [string, string] => [m.unitId ?? '', m.unit]);
  populate('field-filter', 'כל התחומים', new Map(fields));
  populate('unit-filter', 'כל היחידות', new Map(units));
}
function sourceLink(member: Membership): HTMLElement | null {
  if (!member.source) return null;
  try {
    const url = new URL(member.source);
    if (url.protocol !== 'https:') return null;
    const link = document.createElement('a');
    link.textContent = member.page ? `פתיחת המקור · עמוד ${String(member.page)}` : 'פתיחת המקור';
    link.href = url.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  } catch {
    return null;
  }
}
const LABELS: Record<Validity, string> = {
  valid: 'בתוקף',
  expired: 'פג תוקף',
  undated: 'ללא תאריך סיום',
  future: 'טרם החל',
};
function card(supplier: Supplier, day: string): HTMLElement {
  const node = element('article', '', 'card');
  node.append(
    element('h3', supplier.name),
    element('p', supplier.verified ? 'ספק מאומת' : 'ספק לא מאומת', 'details'),
  );
  for (const member of supplier.memberships) {
    const description = [member.registry, member.field, LABELS[validity(member, day)]]
      .filter(Boolean)
      .join(' · ');
    const line = element('p', description, 'field');
    const link = sourceLink(member);
    if (link) line.append(document.createTextNode(' · '), link);
    node.append(line);
  }
  for (const contact of supplier.contacts.filter((item) =>
    ['phone', 'email'].includes(item.kind),
  )) {
    const label = contact.kind === 'phone' ? 'טלפון' : 'דוא״ל';
    node.append(
      element(
        'p',
        `${label}: ${contact.value}${contact.valid === false ? ' (לא תקין)' : ''}`,
        'details',
      ),
    );
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'secondary supplier-detail-open';
  button.textContent = 'פרטי ספק';
  button.setAttribute('aria-label', `פרטי ספק: ${supplier.name}`);
  button.addEventListener('click', () => {
    openSupplier?.(supplier.id);
  });
  node.append(button);
  return node;
}
export function render(): void {
  const current = filters();
  const rows = filterCatalog(suppliers, current);
  const result = el('results');
  const fragment = document.createDocumentFragment();
  rows.forEach((row) => {
    fragment.append(card(row, current.today));
  });
  result.replaceChildren(fragment);
  el('count').textContent = `${String(rows.length)} ספקים`;
  el('empty').hidden = rows.length > 0;
}
export function setSuppliers(rows: Supplier[]): void {
  suppliers = rows;
  options();
  render();
}
