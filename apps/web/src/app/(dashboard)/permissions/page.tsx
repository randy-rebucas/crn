'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Card, EmptyState, ErrorState, Field, Input, LoadingState, PageHeader } from '@/components/ui';

interface Permission {
  id: string;
  key: string;
  resource: string;
  action: string;
  description: string | null;
}

export default function PermissionsPage() {
  const [search, setSearch] = useState('');

  const permissionsQuery = useQuery<Permission[]>({
    queryKey: ['permissions'],
    queryFn: async () => (await apiClient.get('/v1/permissions')).data,
  });

  const grouped = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = (permissionsQuery.data ?? []).filter(
      (p) => !term || p.key.toLowerCase().includes(term) || p.resource.toLowerCase().includes(term),
    );
    const byResource = new Map<string, Permission[]>();
    for (const p of filtered) {
      const list = byResource.get(p.resource) ?? [];
      list.push(p);
      byResource.set(p.resource, list);
    }
    return Array.from(byResource.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [permissionsQuery.data, search]);

  return (
    <div>
      <PageHeader title="Permissions" description="The full permission catalog available to assign to roles." />

      <div className="mb-6 max-w-sm">
        <Field label="Search">
          <Input placeholder="e.g. exams, students…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </Field>
      </div>

      {permissionsQuery.isLoading && <LoadingState />}
      {permissionsQuery.isError && <ErrorState message="Could not load permissions." />}
      {!permissionsQuery.isLoading && grouped.length === 0 && (
        <EmptyState title="No permissions found" description="No permissions match your search." />
      )}

      <div className="space-y-6">
        {grouped.map(([resource, permissions]) => (
          <Card key={resource} className="overflow-hidden">
            <h2 className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {resource}
            </h2>
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-slate-100">
                {permissions.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2 font-medium text-slate-900">{p.key}</td>
                    <td className="px-4 py-2 text-slate-500">{p.action}</td>
                    <td className="px-4 py-2 text-slate-600">{p.description ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}
      </div>
    </div>
  );
}
