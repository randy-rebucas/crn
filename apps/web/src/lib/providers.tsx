'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { AuthProvider } from './auth-context';
import { installMockAuthAdapter } from './mock-auth';

// No backend is running yet, so auth/session calls are served by seeded
// demo users instead. Set NEXT_PUBLIC_USE_MOCKS=false once a real API is available.
if (process.env.NEXT_PUBLIC_USE_MOCKS !== 'false') {
  installMockAuthAdapter();
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
