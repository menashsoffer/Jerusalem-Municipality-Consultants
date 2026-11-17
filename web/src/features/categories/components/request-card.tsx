import { useId } from 'react';
import type { CategoryRequest } from '../model/decision.ts';
import { ReviewForm } from './review-form.tsx';
import styles from './request.module.css';
interface Props {
  request: CategoryRequest;
  categories: { id: string; name: string }[];
}
export function RequestCard({ request, categories }: Props) {
  const heading = useId();
  return (
    <article className={styles.card} aria-labelledby={heading}>
      <h2 id={heading}>{request.proposed_name}</h2>
      <p>{request.description}</p>
      <p>
        קטגוריית אב:{' '}
        {request.parent_id
          ? (categories.find((c) => c.id === request.parent_id)?.name ?? 'אינה פעילה או אינה זמינה')
          : 'קטגוריה ראשית'}
      </p>
      <p>
        מקור הבקשה: <bdi>{request.source_reference ?? 'לא צורף מקור'}</bdi>
      </p>
      <ReviewForm id={request.id} name={request.proposed_name} categories={categories} />
    </article>
  );
}
