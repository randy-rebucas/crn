'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import {
  Button,
  Card,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  Select,
} from '@/components/ui';

const PERMISSION_SCOPES = [
  'GLOBAL',
  'ORGANIZATION',
  'BRANCH',
  'DEPARTMENT',
  'PROGRAM',
  'COURSE',
  'CLASS',
  'ASSIGNED',
  'SELF',
] as const;
type PermissionScope = (typeof PERMISSION_SCOPES)[number];

interface Permission {
  id: string;
  key: string;
  resource: string;
  action: string;
  description: string | null;
}

interface RolePermission {
  id: string;
  scope: PermissionScope;
  permission: Permission;
}

interface Role {
  id: string;
  name: string;
  key: string;
  description: string | null;
  isSystem: boolean;
  permissions: RolePermission[];
}

const createRoleSchema = z.object({
  name: z.string().min(1, 'Required'),
  key: z
    .string()
    .min(1, 'Required')
    .regex(/^[a-z0-9_.-]+$/, 'Lowercase letters, numbers, dots, dashes and underscores only'),
  description: z.string().optional(),
});
type CreateRoleValues = z.infer<typeof createRoleSchema>;

function CreateRoleForm({
  permissions,
  onCreated,
}: {
  permissions: Permission[];
  onCreated: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [selectedScopes, setSelectedScopes] = useState<Record<string, PermissionScope>>({});
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateRoleValues>({ resolver: zodResolver(createRoleSchema) });

  const togglePermission = (key: string, checked: boolean) => {
    setSelectedScopes((prev) => {
      const next = { ...prev };
      if (checked) {
        next[key] = next[key] ?? 'ORGANIZATION';
      } else {
        delete next[key];
      }
      return next;
    });
  };

  const setScope = (key: string, scope: PermissionScope) => {
    setSelectedScopes((prev) => ({ ...prev, [key]: scope }));
  };

  const onSubmit = async (values: CreateRoleValues) => {
    setServerError(null);
    const permissionEntries = Object.entries(selectedScopes);
    if (permissionEntries.length === 0) {
      setServerError('Select at least one permission.');
      return;
    }
    try {
      await apiClient.post('/v1/roles', {
        name: values.name,
        key: values.key,
        description: values.description || undefined,
        permissions: permissionEntries.map(([permissionKey, scope]) => ({ permissionKey, scope })),
      });
      reset();
      setSelectedScopes({});
      onCreated();
    } catch (err) {
      const message = isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined;
      setServerError(message ?? 'Could not create role.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Name" error={errors.name?.message}>
            <Input {...register('name')} placeholder="Branch Coordinator" />
          </Field>
          <Field label="Key" error={errors.key?.message}>
            <Input {...register('key')} placeholder="branch_coordinator" />
          </Field>
          <Field label="Description">
            <Input {...register('description')} placeholder="Optional" />
          </Field>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Permissions</p>
          <div className="max-h-80 overflow-y-auto rounded-md border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-10 px-3 py-2" />
                  <th className="px-3 py-2">Permission</th>
                  <th className="px-3 py-2">Scope</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {permissions.map((permission) => {
                  const checked = permission.key in selectedScopes;
                  return (
                    <tr key={permission.id}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => togglePermission(permission.key, e.target.checked)}
                        />
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        <span className="font-medium text-slate-900">{permission.key}</span>
                        {permission.description && (
                          <span className="ml-2 text-xs text-slate-500">{permission.description}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          disabled={!checked}
                          value={selectedScopes[permission.key] ?? 'ORGANIZATION'}
                          onChange={(e) => setScope(permission.key, e.target.value as PermissionScope)}
                        >
                          {PERMISSION_SCOPES.map((scope) => (
                            <option key={scope} value={scope}>
                              {scope}
                            </option>
                          ))}
                        </Select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {serverError && <p className="text-sm text-red-600">{serverError}</p>}
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating…' : 'Create role'}
          </Button>
        </div>
      </form>
  );
}

function RoleCard({ role }: { role: Role }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{role.name}</p>
          <p className="text-xs text-slate-500">{role.key}</p>
        </div>
        {role.isSystem && (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
            System
          </span>
        )}
      </div>
      {role.description && <p className="mt-2 text-sm text-slate-600">{role.description}</p>}
      {role.permissions.length > 0 && (
        <ul className="mt-3 space-y-1">
          {role.permissions.map((rp) => (
            <li key={rp.id} className="flex items-center justify-between text-xs text-slate-600">
              <span>{rp.permission.key}</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">{rp.scope}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function RolesPage() {
  const { hasPermission } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const rolesQuery = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: async () => (await apiClient.get('/v1/roles')).data,
  });

  const permissionsQuery = useQuery<Permission[]>({
    queryKey: ['permissions'],
    queryFn: async () => (await apiClient.get('/v1/permissions')).data,
    enabled: showForm,
  });

  const permissions = useMemo(() => permissionsQuery.data ?? [], [permissionsQuery.data]);

  return (
    <div>
      <PageHeader
        title="Roles"
        description="Custom roles and the permissions, scoped by access level, that make them up."
        action={
          hasPermission('roles.manage') && (
            <Button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Close' : 'New Role'}</Button>
          )
        }
      />

      <Drawer open={showForm} onClose={() => setShowForm(false)} title="New role">
        {permissionsQuery.isLoading && <LoadingState />}
        {permissionsQuery.isError && (
          <ErrorState message="Could not load available permissions. You may be missing the permissions.manage permission." />
        )}
        {!permissionsQuery.isLoading && !permissionsQuery.isError && (
          <CreateRoleForm
            permissions={permissions}
            onCreated={() => {
              setShowForm(false);
              queryClient.invalidateQueries({ queryKey: ['roles'] });
            }}
          />
        )}
      </Drawer>

      {rolesQuery.isLoading && <LoadingState />}
      {rolesQuery.isError && <ErrorState message="Could not load roles." />}
      {!rolesQuery.isLoading && !rolesQuery.isError && rolesQuery.data?.length === 0 && (
        <EmptyState title="No roles yet" description="Create a custom role to get started." />
      )}

      {!rolesQuery.isLoading && rolesQuery.data && rolesQuery.data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rolesQuery.data.map((role) => (
            <RoleCard key={role.id} role={role} />
          ))}
        </div>
      )}
    </div>
  );
}
