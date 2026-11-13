import { duplicates } from './duplicates.ts';
import { saveMembership, writeContext } from './data/site.ts';
import type { WriteContext } from './data/write-context.ts';

let context: WriteContext | null = null;
let token = '';
let onSaved: (() => Promise<void>) | null = null;
function target(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element ${id}`);
  return node;
}
function input(id: string): HTMLInputElement {
  return target(id) as HTMLInputElement;
}
function select(id: string): HTMLSelectElement {
  return target(id) as HTMLSelectElement;
}
function form(): HTMLFormElement {
  return target('supplier-add-form') as HTMLFormElement;
}
function dialog(): HTMLDialogElement {
  return target('add-dialog') as HTMLDialogElement;
}
function optionLabel(version: WriteContext['versions'][number]): string {
  return `${version.name} · ${version.validFrom ?? 'ללא תחילה'} – ${version.validUntil ?? 'ללא סיום'}`;
}
function versionOptions(): void {
  const node = select('add-version');
  node.replaceChildren(new Option('בחרו מאגר', ''));
  for (const version of context?.versions ?? [])
    node.add(new Option(optionLabel(version), version.versionId));
  fields();
}
function fields(): void {
  const node = select('add-registry-field');
  const version = context?.versions.find((item) => item.versionId === select('add-version').value);
  node.replaceChildren(new Option(version ? 'בחרו תחום' : 'בחרו תחילה מאגר', ''));
  for (const item of context?.catalog.fields ?? []) {
    if (item.registry_id === version?.registryId) node.add(new Option(item.source_text, item.id));
  }
  node.disabled = !version;
}
function choice(id: string, text: string): HTMLLabelElement {
  const label = document.createElement('label');
  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = 'supplier_choice';
  radio.value = id;
  label.append(radio, document.createTextNode(text));
  return label;
}
function updateDuplicates(): void {
  const list = target('duplicate-list');
  const matches = context
    ? duplicates(context, input('add-name').value, input('add-identifier').value)
    : [];
  list.replaceChildren();
  target('duplicate-choices').hidden = matches.length === 0;
  for (const candidate of matches) {
    list.append(
      choice(candidate.id, `${candidate.name}${candidate.identifierMatch ? ' · מזהה זהה' : ''}`),
    );
  }
  if (matches.length) list.append(choice('new', 'יצירת ספק חדש בכל זאת'));
}
function formText(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === 'string' ? value.trim() : '';
}
function values(): Record<string, string> {
  const result: Record<string, string> = {};
  const data = new FormData(form());
  for (const key of [
    'display_name',
    'entity_kind',
    'identifier',
    'identifier_scheme',
    'registry_version_id',
    'registry_field_id',
    'registered_from',
    'registered_until',
    'engagement_started_on',
    'phone',
    'email',
  ])
    result[key] = formText(data, key);
  const selected = formText(data, 'supplier_choice');
  if (!target('duplicate-choices').hidden && !selected)
    throw new Error('יש לבחור ספק קיים או יצירה חדשה.');
  if (selected && selected !== 'new') result.supplier_id = selected;
  if (!!result.identifier !== !!result.identifier_scheme)
    throw new Error('יש למלא גם סוג מזהה וגם מספר, או להשאיר את שניהם ריקים.');
  return result;
}
async function submit(event: Event): Promise<void> {
  event.preventDefault();
  const error = target('supplier-add-error');
  const button = target('supplier-save') as HTMLButtonElement;
  error.textContent = '';
  button.disabled = true;
  try {
    await saveMembership(token, values());
  } catch (problem) {
    error.textContent = problem instanceof Error ? problem.message : 'השמירה נכשלה.';
    button.disabled = false;
    return;
  }
  dialog().close();
  form().reset();
  const message = target('catalog-feedback');
  try {
    if (onSaved) await onSaved();
    message.textContent = 'הרישום נשמר וממתין לאימות.';
  } catch {
    message.textContent = 'הרישום נשמר, אך הרשימה לא התרעננה. יש לרענן לפני ניסיון נוסף.';
  }
  message.hidden = false;
  button.disabled = false;
}
export function bind(refresh: () => Promise<void>): void {
  onSaved = refresh;
  target('add-close').addEventListener('click', () => {
    dialog().close();
  });
  select('add-version').addEventListener('change', fields);
  input('add-name').addEventListener('input', updateDuplicates);
  input('add-identifier').addEventListener('input', updateDuplicates);
  form().addEventListener('submit', (event) => {
    void submit(event);
  });
}
export async function open(sessionToken: string): Promise<void> {
  token = sessionToken;
  context = null;
  form().reset();
  target('supplier-add-error').textContent = 'טוען מאגרים...';
  (target('supplier-save') as HTMLButtonElement).disabled = true;
  if (!dialog().open) dialog().showModal();
  try {
    context = await writeContext(token);
    versionOptions();
    updateDuplicates();
    target('supplier-add-error').textContent = context.versions.length
      ? ''
      : 'אין מאגר זמין ביחידה שלך.';
    (target('supplier-save') as HTMLButtonElement).disabled = context.versions.length === 0;
  } catch (problem) {
    target('supplier-add-error').textContent =
      problem instanceof Error ? problem.message : 'לא ניתן לטעון את המאגרים.';
  }
}
