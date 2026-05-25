// ════════════════════════════════════════════════════════════════════════════
// LEMISPHERE — PROVIDERS WRAPPER
// TanStack Query + global store initialization
// ════════════════════════════════════════════════════════════════════════════
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { useAppStore } from '@/stores/appStore';

function StoreInitializer() {
  const initDeviceId = useAppStore((s) => s.initDeviceId);

  useEffect(() => {
    initDeviceId();
  }, [initDeviceId]);

  return null;
}

function OnlineStatusWatcher() {
  const setSyncState = useAppStore((s) => s.setSyncState);

  useEffect(() => {
    const setOnline  = () => setSyncState({ isOnline: true });
    const setOffline = () => setSyncState({ isOnline: false });

    setSyncState({ isOnline: navigator.onLine });
    window.addEventListener('online',  setOnline);
    window.addEventListener('offline', setOffline);
    return () => {
      window.removeEventListener('online',  setOnline);
      window.removeEventListener('offline', setOffline);
    };
  }, [setSyncState]);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <StoreInitializer />
      <OnlineStatusWatcher />
      {children}
    </QueryClientProvider>
  );
}
