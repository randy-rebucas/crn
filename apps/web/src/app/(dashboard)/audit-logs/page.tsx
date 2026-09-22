'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Button, Card, EmptyState, ErrorState, Field, Input, LoadingState, PageHeader } from '@/components/ui';

interface AuditLog {
  id: string;
  actorId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  beforeState: unknown;
  afterState: unknown;
  reason: string | null;
  createdAt: string;
}

function StateCell({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-slate-400">—</span>;
  return (
    <details>
      <summary className="cursor-pointer text-xs text-red-700">View</summary>
      <pre className="mt-1 max-w-xs overflow-x-auto rounded bg-slate-50 p-2 text-xs text-slate-600">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

export default function AuditLogsPage() {
  const [resourceInput, setResourceInput] = useState('');
  const [resourceIdInput, setResourceIdInput] = useState('');
  const [filters, setFilters] = useState<{ resource?: string; resourceId?: string }>({});

  const { data, isLoading, isError } = useQuery<AuditLog[]>({
    queryKey: ['audit-logs', filters],
    queryFn: async () =>
      (
        await apiClient.get('/v1/audit-logs', {
          params: {
            resource: filters.resource || undefined,
            resourceId: filters.resourceId || undefined,
          },
        })
      ).data,
  });

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters({ resource: resourceInput.trim() || undefined, resourceId: resourceIdInput.trim() || undefined });
  };

  const clearFilters = () => {
    setResourceInput('');
    setResourceIdInput('');
    setFilters({});
  };

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="Immutable record of actions taken across the system. Read-only, most recent first."
      />

      <Card className="mb-6 p-4">
        <form onSubmit={applyFilters} className="flex flex-wrap items-end gap-3">
          <div className="w-48">
            <Field label="Resource">
              <Input
                value={resourceInput}
                onChange={(e) => setResourceInput(e.target.value)}
                placeholder="e.g. role"
              />
            </Field>
          </div>
          <div className="w-64">
            <Field label="Resource ID">
              <Input
                value={resourceIdInput}
                onChange={(e) => setResourceIdInput(e.target.value)}
                placeholder="exact resource ID"
              />
            </Field>
          </div>
          <Button type="submit" variant="secondary">
            Apply filters
          </Button>
          <Button type="button" variant="ghost" onClick={clearFilters}>
            Clear
          </Button>
        </form>
        <p className="mt-2 text-xs text-slate-500">
          Filtering by actor or date range is not currently supported by the API and is not shown here.
        </p>
      </Card>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="Could not load audit logs." />}
      {!isLoading && !isError && data?.length === 0 && (
        <EmptyState title="No audit entries" description="No audit entries match the current filters." />
      )}

      {!isLoading && data && data.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Resource</th>
                <th className="px-4 py-3">IP</th>
                <th className="px-4 py-3">Before</th>
                <th className="px-4 py-3">After</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{log.actorId ?? '—'}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{log.action}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {log.resource}
                    {log.resourceId && <span className="ml-1 text-xs text-slate-400">{log.resourceId}</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{log.ipAddress ?? '—'}</td>
                  <td className="px-4 py-3">
                    <StateCell value={log.beforeState} />
                  </td>
                  <td className="px-4 py-3">
                    <StateCell value={log.afterState} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
