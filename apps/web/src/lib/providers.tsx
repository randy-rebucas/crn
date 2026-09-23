'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { AuthProvider } from './auth-context';

// Demo-user auth is opt-in only: it must never activate just because an env
// var was left unset in a deployment. Set NEXT_PUBLIC_USE_MOCKS=true locally
// to exercise the UI against seeded demo accounts without a live API.
//
// The import is dynamic, not static, so that when NEXT_PUBLIC_USE_MOCKS is
// unset/false, Next.js inlines the condition to a literal `false` at build
// time and tree-shakes this branch (and everything mock-auth.ts pulls in,
// including the demo credential list in demo-users.ts) out of the
// production bundle entirely — a static top-level import would ship that
// module regardless of the runtime check.
if (process.env.NEXT_PUBLIC_USE_MOCKS === 'true') {
  import('./mock-auth').then(({ installMockAuthAdapter }) => installMockAuthAdapter());
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
