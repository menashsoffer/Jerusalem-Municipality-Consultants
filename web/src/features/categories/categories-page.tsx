import { useLoaderData, useNavigation } from 'react-router';
import { EmptyState } from '../../ui/empty-state.tsx';
import { Skeleton } from '../../ui/skeleton.tsx';
import { loadRequests } from './api/requests.ts';
import { RequestCard } from './components/request-card.tsx';
export const loader = loadRequests;
export function CategoriesPage() {
  const data = useLoaderData<typeof loader>(),
    navigation = useNavigation();
  return (
    <>
      <h1 tabIndex={-1}>בקשות קטגוריה</h1>
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
    </>
  );
}
