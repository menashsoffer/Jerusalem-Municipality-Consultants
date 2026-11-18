import { useLoaderData, useNavigation } from 'react-router';
import { EmptyState } from '../../ui/empty-state.tsx';
import { PageHeader } from '../../ui/page-header.tsx';
import { Skeleton } from '../../ui/skeleton.tsx';
import { loadRequests } from './api/requests.ts';
import { RequestCard } from './components/request-card.tsx';
import styles from './components/request.module.css';
export const loader = loadRequests;
export function CategoriesPage() {
  const data = useLoaderData<typeof loader>(),
    navigation = useNavigation();
  return (
    <div className={styles.list}>
      <PageHeader
        title={`בקשות קטגוריה (${String(data.requests.length)})`}
        lead="כל בקשה מאושרת כקטגוריה חדשה, מקושרת לקטגוריה קיימת או נדחית, ותמיד עם נימוק."
        back={{ to: '/admin', label: 'ניהול' }}
      />
      {navigation.state === 'loading' ? (
        <Skeleton />
      ) : data.requests.length === 0 ? (
        <EmptyState title="אין בקשות קטגוריה ממתינות">
          <p>כל הבקשות הקיימות טופלו.</p>
        </EmptyState>
      ) : (
        data.requests.map((request) => (
          <RequestCard key={request.id} request={request} categories={data.categories} />
        ))
      )}
    </div>
  );
}
