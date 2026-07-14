import { useCallback, useEffect, useRef, useState } from 'react';

export interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export type QueryFn<T> = () => Promise<T>;

/**
 * Generic async-data hook with loading / error / refetch and unmount safety.
 *
 * - `fn` is the async loader (re-created each render is fine; we capture it in a ref).
 * - `deps` controls re-execution, exactly like a useEffect dependency array.
 * - `refetch` manually re-runs the loader (e.g. a Refresh button).
 *
 * Requests are cancelled on unmount / deps change so stale responses never
 * land in state — keeping the UI consistent with the latest data source.
 */
export function useQuery<T>(fn: QueryFn<T>, deps: React.DependencyList = []): QueryState<T> & {
  refetch: () => void;
} {
  const [state, setState] = useState<QueryState<T>>({ data: null, loading: true, error: null });
  const fnRef = useRef<QueryFn<T>>(fn);
  fnRef.current = fn;
  const mounted = useRef(true);

  const run = useCallback(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fnRef
      .current()
      .then((data) => {
        if (active && mounted.current) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (active && mounted.current) {
          const message = err instanceof Error ? err.message : 'Failed to load data.';
          setState({ data: null, loading: false, error: message });
        }
      })
      .finally(() => {
        active = false;
      });
  }, []);

  useEffect(() => {
    mounted.current = true;
    run();
    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, refetch: run };
}
