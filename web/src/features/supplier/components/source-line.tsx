import type { SupplierDetail } from '../../../data/supplier-detail.ts';
import { safeSourceUrl } from '../model/labels.ts';
import styles from './supplier.module.css';

interface Props {
  documents: SupplierDetail['documents'];
  documentId: string | null;
  page?: number | null;
}
/** Where a fact came from. Every fact on the screen names its source, or says it has none. */
export function SourceLine({ documents, documentId, page }: Props) {
  const item = documents.find((document) => document.id === documentId);
  if (!item) return <span>מקור: לא תועד</span>;
  const url = safeSourceUrl(item.url);
  if (!url) return <span>מקור תועד; הקישור אינו זמין</span>;
  return (
    <span>
      מקור:{' '}
      <a href={url} target="_blank" rel="noopener noreferrer">
        {page ? `מסמך מקור · עמוד ${String(page)}` : 'מסמך מקור'}
      </a>
    </span>
  );
}

export function Fact({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <p className={styles.fact}>
      <span>{text}</span>
      {children}
    </p>
  );
}
