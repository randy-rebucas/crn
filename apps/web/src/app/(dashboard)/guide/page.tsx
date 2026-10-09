'use client';

import { useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { visibleNavGroups } from '@/components/admin-nav';
import { UserGuide } from '@/components/user-guide';

export default function DashboardGuidePage() {
  const { hasPermission } = useAuth();
  // Only used when the account's roles have no written guide (a custom role):
  // the generic guide then lists the same pages the sidebar shows.
  const pages = useMemo(
    () =>
      visibleNavGroups(hasPermission)
        .flatMap((group) => group.items)
        .filter((item) => item.href !== '/guide')
        .map(({ label, href }) => ({ label, href })),
    [hasPermission],
  );

  return <UserGuide portal="dashboard" fallbackPages={pages} />;
}
