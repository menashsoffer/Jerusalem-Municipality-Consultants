import type { SupplierDetail } from '../../../data/supplier-detail.ts';
import {
  CONTACT_KINDS,
  ENTITY_KINDS,
  ID_SOURCES,
  ID_TYPES,
  NAME_KINDS,
  REVIEW,
  auditLine,
  membershipDates,
} from '../model/labels.ts';
import { Fact, SourceLine } from './source-line.tsx';

interface Props {
  data: SupplierDetail;
}
const NO_RECORD = <span>מקור: לא תועד ברשומת הספק</span>;

function Info({ data }: Props) {
  const { supplier } = data;
  return (
    <section aria-labelledby="supplier-info">
      <h2 id="supplier-info">פרטי הספק</h2>
      <Fact text={supplier.review_status === 'verified' ? 'ספק מאומת' : 'ספק לא מאומת'}>
        <span>מקור: מצב האימות במערכת</span>
      </Fact>
      {supplier.status === 'inactive' && (
        <p role="note">
          {[
            'הספק אינו פעיל',
            supplier.status_reason && `סיבה: ${supplier.status_reason}`,
            supplier.status_source && `מקור: ${supplier.status_source}`,
            supplier.status_changed_on && `מתאריך ${supplier.status_changed_on}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
      <Fact text={`סוג ישות: ${ENTITY_KINDS[supplier.entity_kind] ?? 'לא ידוע'}`}>{NO_RECORD}</Fact>
      {supplier.website && <Fact text={`אתר: ${supplier.website}`}>{NO_RECORD}</Fact>}
      {supplier.note && <Fact text={`הערה: ${supplier.note}`}>{NO_RECORD}</Fact>}
    </section>
  );
}

function Names({ data }: Props) {
  return (
    <section aria-labelledby="supplier-names">
      <h2 id="supplier-names">שמות</h2>
      <Fact text={`שם מוצג: ${data.supplier.display_name}`}>{NO_RECORD}</Fact>
      {data.names.length === 0 && <p>לא תועדו שמות נוספים.</p>}
      {data.names.map((name, index) => (
        <Fact key={index} text={`${NAME_KINDS[name.kind] ?? 'שם נוסף'}: ${name.name}`}>
          <SourceLine documents={data.documents} documentId={name.source_document_id} />
        </Fact>
      ))}
    </section>
  );
}

function Identifiers({ data }: Props) {
  return (
    <section aria-labelledby="supplier-identifiers">
      <h2 id="supplier-identifiers">מזהים</h2>
      {data.identifiers.length === 0 && <p>לא תועדו מזהים שניתן להציג.</p>}
      {data.identifiers.map((item) => (
        <Fact
          key={item.id}
          text={`${ID_TYPES[item.scheme] ?? 'מזהה'}: ${item.value} · ${REVIEW[item.review_status] ?? 'מצב לא ידוע'}`}
        >
          <span>מקור: {ID_SOURCES[item.source] ?? 'לא תועד'}</span>
        </Fact>
      ))}
    </section>
  );
}

function Contacts({ data }: Props) {
  return (
    <section aria-labelledby="supplier-contacts">
      <h2 id="supplier-contacts">פרטי קשר</h2>
      {data.contacts.length === 0 && <p>לא תועדו פרטי קשר.</p>}
      {data.contacts.map((item) => (
        <Fact
          key={item.id}
          text={`${CONTACT_KINDS[item.kind] ?? 'פרט קשר'}: ${item.value}${item.is_valid === false ? ' · לא תקין לפי בדיקה אוטומטית' : ''}`}
        >
          <SourceLine documents={data.documents} documentId={item.source_document_id} />
        </Fact>
      ))}
    </section>
  );
}

function Membership({ data, item }: Props & { item: SupplierDetail['memberships'][number] }) {
  const version = data.versions.find((value) => value.id === item.registry_version_id);
  const registry = data.registries.find((value) => value.id === version?.registry_id);
  const field = data.fields.find((value) => value.id === item.registry_field_id);
  return (
    <article>
      <h3>{registry?.name ?? 'מאגר לא זמין'}</h3>
      <p>{REVIEW[item.review_status] ?? 'מצב הרישום לא ידוע'}</p>
      <Fact text={`תחום: ${field?.source_text ?? 'לא צוין'}`}>
        <SourceLine
          documents={data.documents}
          documentId={version?.source_document_id ?? null}
          page={item.source_page}
        />
      </Fact>
      <p>{membershipDates(item)}</p>
    </article>
  );
}

function Memberships({ data }: Props) {
  return (
    <section aria-labelledby="supplier-memberships">
      <h2 id="supplier-memberships">רישום במאגרים</h2>
      {data.memberships.length === 0 && <p>אין רישומים שניתן להציג.</p>}
      {data.memberships.map((item, index) => (
        <Membership key={index} data={data} item={item} />
      ))}
    </section>
  );
}

/** The audit trail is returned only to roles allowed to read it; `null` hides the section. */
function History({ data }: Props) {
  if (data.audit === null) return null;
  return (
    <section aria-labelledby="supplier-history">
      <h2 id="supplier-history">היסטוריית שינויים</h2>
      {data.audit.length === 0 && <p>לא נמצאו שינויים ביומן.</p>}
      {data.audit.map((item) => (
        <p key={item.id}>{auditLine(item)}</p>
      ))}
    </section>
  );
}

export function SupplierDetails({ data }: Props) {
  return (
    <>
      <Info data={data} />
      <Names data={data} />
      <Identifiers data={data} />
      <Contacts data={data} />
      <Memberships data={data} />
      <History data={data} />
    </>
  );
}
