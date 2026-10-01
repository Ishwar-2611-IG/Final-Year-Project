import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const LoadingContext = createContext(null);

export function LoadingProvider({ children }) {
  const [count, setCount] = useState(0);

  const startLoading = useCallback(() => setCount((prev) => prev + 1), []);
  const stopLoading = useCallback(() => setCount((prev) => Math.max(0, prev - 1)), []);

  const value = useMemo(
    () => ({ active: count > 0, startLoading, stopLoading }),
    [count, startLoading, stopLoading]
  );

  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within LoadingProvider');
  }
  return context;
}
