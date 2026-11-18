// The saved-requests list as page state, so a save, edit or cancel shows in it at once.
// Only the list is fetched again: the page loader would also re-read the picked suppliers,
// which a save empties, and close the new request's result step.
import { createContext, useCallback, useContext, useState } from 'react';
import { identity } from '../../../data/rpc.ts';
import { loadSaved, type SavedRequest } from '../api/saved.ts';

type List = SavedRequest[] | null;
interface State {
  from: List;
  list: List;
  /** The last reload failed, so the list may miss a change that was saved. */
  stale: boolean;
}

const ReloadSaved = createContext<() => Promise<void>>(() => Promise.resolve());
export const ReloadSavedProvider = ReloadSaved.Provider;

/** Fetches the saved list again; a failure leaves the shown list and marks it stale. */
export function useReloadSaved(): () => Promise<void> {
  return useContext(ReloadSaved);
}

/** Starts from the loader's list and follows it whenever the loader runs again. */
export function useSavedList(fromLoader: List) {
  const [state, setState] = useState<State>({ from: fromLoader, list: fromLoader, stale: false });
  if (state.from !== fromLoader) setState({ from: fromLoader, list: fromLoader, stale: false });
  const reload = useCallback(async () => {
    try {
      const list = await loadSaved(await identity());
      setState((s) => ({ ...s, list, stale: false }));
    } catch {
      setState((s) => ({ ...s, stale: true }));
    }
  }, []);
  const current = state.from === fromLoader ? state : { list: fromLoader, stale: false };
  return { list: current.list, stale: current.stale, reload };
}
