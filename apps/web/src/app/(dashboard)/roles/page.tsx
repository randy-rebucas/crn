'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  PageHeader,
  Select,
  Textarea,
} from '@/components/ui';
import { icons as baseIcons } from '@/components/student-ui';
import { adminIcons } from '@/components/admin-shell';

// Widest reach first — this order is also used to pick a role's widest scope.
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

const SCOPE_HINTS: Record<PermissionScope, string> = {
  GLOBAL: 'Everything, across organizations',
  ORGANIZATION: 'The whole organization',
  BRANCH: "Only the user's branch",
  DEPARTMENT: "Only the user's department",
  PROGRAM: 'Only programs the user belongs to',
  COURSE: 'Only courses the user belongs to',
  CLASS: 'Only classes the user belongs to',
  ASSIGNED: 'Only records assigned to the user',
  SELF: "Only the user's own records",
};

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
  _count?: { users: number };
  permissions: RolePermission[];
}

type RoleFilter = 'all' | 'system' | 'custom';

function humanize(value: string) {
  const text = value.replace(/[_.-]+/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function groupByResource<T>(items: T[], resourceOf: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const resource = resourceOf(item);
    groups.set(resource, [...(groups.get(resource) ?? []), item]);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function scopesOf(role: Role) {
  const present = new Set(role.permissions.map((rp) => rp.scope));
  return PERMISSION_SCOPES.filter((s) => present.has(s));
}

const plusIcon = (
  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
  </svg>
);

const chevronRight = (
  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
    <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function ScopeBadge({ scope }: { scope: PermissionScope }) {
  return (
    <span
      title={SCOPE_HINTS[scope]}
      className="inline-flex shrink-0 items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600"
    >
      {humanize(scope)}
    </span>
  );
}

function RoleTypeBadge({ isSystem }: { isSystem: boolean }) {
  return isSystem ? (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
      System
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
      Custom
    </span>
  );
}

function RoleAvatar({ isSystem }: { isSystem: boolean }) {
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg [&_svg]:h-[18px] [&_svg]:w-[18px] ${
        isSystem ? 'bg-slate-900 text-white' : 'bg-red-700 text-white'
      }`}
      aria-hidden="true"
    >
      {isSystem ? adminIcons.shield : adminIcons.key}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Create form

const createRoleSchema = z.object({
  name: z.string().trim().min(1, 'Give the role a name'),
  key: z
    .string()
    .min(1, 'Give the role a key')
    .regex(/^[a-z0-9_]+$/, 'Lowercase letters, numbers and underscores only'),
  description: z.string().optional(),
});
type CreateRoleValues = z.infer<typeof createRoleSchema>;

function GroupCheckbox({
  checked,
  indeterminate,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 cursor-pointer accent-red-700"
    />
  );
}

// Creates a role, or edits one when `role` is given (the key stays fixed and
// the permission set sent on save replaces the role's current one).
function RoleForm({
  permissions,
  role,
  onSaved,
}: {
  permissions: Permission[];
  role?: Role;
  onSaved: () => void;
}) {
  const editing = Boolean(role);
  const [serverError, setServerError] = useState<string | null>(null);
  const [selectedScopes, setSelectedScopes] = useState<Record<string, PermissionScope>>(() =>
    Object.fromEntries((role?.permissions ?? []).map((rp) => [rp.permission.key, rp.scope])),
  );
  const [defaultScope, setDefaultScope] = useState<PermissionScope>('ORGANIZATION');
  const [search, setSearch] = useState('');
  const [keyTouched, setKeyTouched] = useState(editing);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateRoleValues>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: role ? { name: role.name, key: role.key, description: role.description ?? '' } : undefined,
  });

  const nameField = register('name');
  const keyField = register('key');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return permissions;
    return permissions.filter(
      (p) => p.key.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q),
    );
  }, [permissions, search]);
  const groups = useMemo(() => groupByResource(filtered, (p) => p.resource), [filtered]);
  const selectedCount = Object.keys(selectedScopes).length;

  const setChecked = (keys: string[], checked: boolean) => {
    setSelectedScopes((prev) => {
      const next = { ...prev };
      for (const key of keys) {
        if (checked) next[key] = next[key] ?? defaultScope;
        else delete next[key];
      }
      return next;
    });
  };

  const onSubmit = async (values: CreateRoleValues) => {
    setServerError(null);
    const permissionEntries = Object.entries(selectedScopes);
    if (permissionEntries.length === 0) {
      setServerError('Pick at least one permission for this role.');
      return;
    }
    const grants = permissionEntries.map(([permissionKey, scope]) => ({ permissionKey, scope }));
    try {
      if (role) {
        await apiClient.patch(`/v1/roles/${role.id}`, {
          name: values.name.trim(),
          description: values.description?.trim() || null,
          permissions: grants,
        });
      } else {
        await apiClient.post('/v1/roles', {
          name: values.name.trim(),
          key: values.key,
          description: values.description?.trim() || undefined,
          permissions: grants,
        });
        reset();
        setKeyTouched(false);
        setSelectedScopes({});
      }
      onSaved();
    } catch (err) {
      const message = isAxiosError<{ message?: string | string[] }>(err) ? err.response?.data?.message : undefined;
      setServerError(
        (Array.isArray(message) ? message.join('. ') : message) ??
          `Could not ${role ? 'save' : 'create'} the role. Check the details and try again.`,
      );
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-full flex-col">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" error={errors.name?.message}>
            <Input
              {...nameField}
              placeholder="Branch Coordinator"
              onChange={(e) => {
                nameField.onChange(e);
                if (!keyTouched) setValue('key', slugify(e.target.value));
              }}
            />
          </Field>
          <Field label="Key" error={errors.key?.message}>
            <Input
              {...keyField}
              placeholder="branch_coordinator"
              disabled={editing}
              onChange={(e) => {
                setKeyTouched(e.target.value !== '');
                keyField.onChange(e);
              }}
            />
          </Field>
        </div>
        <Field label="Description">
          <Textarea {...register('description')} rows={2} placeholder="What this role is for (optional)" />
        </Field>
      </div>

      <div className="mt-6 border-t border-slate-100 pt-5">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Permissions</h3>
            <p className="text-xs text-slate-500">Tick what this role can do, then set how far each one reaches.</p>
          </div>
        </div>
        <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <label className="relative block">
            <span className="sr-only">Search permissions</span>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              {baseIcons.search}
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search permissions"
              className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-red-600 focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <span className="shrink-0">New ticks get</span>
            <select
              value={defaultScope}
              onChange={(e) => setDefaultScope(e.target.value as PermissionScope)}
              className="rounded-md border border-slate-300 bg-white px-2 py-2 text-xs text-slate-700 focus:border-red-600 focus:outline-none"
            >
              {PERMISSION_SCOPES.map((scope) => (
                <option key={scope} value={scope}>
                  {humanize(scope)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {groups.length === 0 && (
          <p className="rounded-md border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">
            No permissions match “{search}”.
          </p>
        )}

        <div className="space-y-3">
          {groups.map(([resource, items]) => {
            const keys = items.map((p) => p.key);
            const checkedCount = keys.filter((k) => k in selectedScopes).length;
            return (
              <fieldset key={resource} className="overflow-hidden rounded-lg border border-slate-200">
                <legend className="sr-only">{humanize(resource)}</legend>
                <div className="flex items-center gap-3 bg-slate-50 px-3 py-2">
                  <GroupCheckbox
                    label={`Select all ${humanize(resource)} permissions`}
                    checked={checkedCount === keys.length}
                    indeterminate={checkedCount > 0 && checkedCount < keys.length}
                    onChange={(checked) => setChecked(keys, checked)}
                  />
                  <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {humanize(resource)}
                  </span>
                  <span className="text-xs tabular-nums text-slate-400">
                    {checkedCount}/{keys.length}
                  </span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {items.map((permission) => {
                    const checked = permission.key in selectedScopes;
                    const inputId = `perm-${permission.id}`;
                    return (
                      <li key={permission.id} className={`flex items-start gap-3 px-3 py-2.5 ${checked ? 'bg-red-50/40' : ''}`}>
                        <input
                          id={inputId}
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => setChecked([permission.key], e.target.checked)}
                          className="mt-0.5 h-4 w-4 cursor-pointer accent-red-700"
                        />
                        <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer">
                          <span className="block text-sm font-medium text-slate-900">{humanize(permission.action)}</span>
                          <span className="block text-xs text-slate-500">
                            {permission.description ?? permission.key}
                          </span>
                        </label>
                        {checked && (
                          <div className="w-32 shrink-0">
                            <Select
                              aria-label={`Scope for ${permission.key}`}
                              value={selectedScopes[permission.key]}
                              onChange={(e) =>
                                setSelectedScopes((prev) => ({ ...prev, [permission.key]: e.target.value as PermissionScope }))
                              }
                            >
                              {PERMISSION_SCOPES.map((scope) => (
                                <option key={scope} value={scope}>
                                  {humanize(scope)}
                                </option>
                              ))}
                            </Select>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            );
          })}
        </div>
      </div>

      <div className="sticky bottom-0 -mx-5 -mb-4 mt-6 border-t border-slate-200 bg-white px-5 py-3">
        {serverError && <p className="mb-2 text-sm text-red-600">{serverError}</p>}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            <span className="font-semibold tabular-nums text-slate-900">{selectedCount}</span>{' '}
            {selectedCount === 1 ? 'permission' : 'permissions'} selected
          </span>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : editing ? 'Save changes' : 'Create role'}
          </Button>
        </div>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Role detail

function RoleDetail({
  role,
  canManage,
  onEdit,
  onDeleted,
}: {
  role: Role;
  canManage: boolean;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const groups = groupByResource(role.permissions, (rp) => rp.permission.resource);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const assigned = role._count?.users ?? 0;
  const editable = canManage && !role.isSystem;

  const remove = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.delete(`/v1/roles/${role.id}`);
      onDeleted();
    } catch (err) {
      const message = isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined;
      setDeleteError(message ?? 'Could not delete the role.');
      setDeleting(false);
    }
  };
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <RoleAvatar isSystem={role.isSystem} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-slate-900">{role.name}</p>
            <RoleTypeBadge isSystem={role.isSystem} />
          </div>
          <p className="font-mono text-xs text-slate-500">{role.key}</p>
        </div>
      </div>

      {role.description && <p className="text-sm text-slate-600">{role.description}</p>}
      {role.isSystem && (
        <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
          System roles ship with the platform and can&apos;t be changed here.
        </p>
      )}
      {role._count && (
        <p className="text-sm text-slate-600">
          Assigned to <span className="font-semibold tabular-nums text-slate-900">{assigned}</span>{' '}
          {assigned === 1 ? 'person' : 'people'}.
        </p>
      )}
      {editable && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button onClick={onEdit}>Edit role</Button>
            {confirmDelete ? (
              <>
                <Button variant="danger" disabled={deleting} onClick={remove}>
                  {deleting ? 'Deleting…' : 'Yes, delete this role'}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="secondary" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            )}
          </div>
          {confirmDelete && assigned > 0 && !deleteError && (
            <p className="text-xs text-amber-800">
              {assigned} {assigned === 1 ? 'person has' : 'people have'} this role. Reassign them first or the delete will be
              refused.
            </p>
          )}
          {deleteError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{deleteError}</p>
          )}
        </div>
      )}

      <dl className="grid grid-cols-3 divide-x divide-slate-100 rounded-lg border border-slate-200 py-3 text-center">
        <div>
          <dt className="text-xs text-slate-500">Permissions</dt>
          <dd className="text-lg font-semibold tabular-nums text-slate-900">{role.permissions.length}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Modules</dt>
          <dd className="text-lg font-semibold tabular-nums text-slate-900">{groups.length}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Widest scope</dt>
          <dd className="mt-1 text-sm font-semibold text-slate-900">
            {scopesOf(role)[0] ? humanize(scopesOf(role)[0]) : '—'}
          </dd>
        </div>
      </dl>

      {groups.length === 0 ? (
        <p className="text-sm text-slate-500">This role has no permissions.</p>
      ) : (
        <div className="space-y-4">
          {groups.map(([resource, items]) => (
            <section key={resource}>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{humanize(resource)}</h3>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {items.map((rp) => (
                  <li key={rp.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm text-slate-800">{humanize(rp.permission.action)}</p>
                      {rp.permission.description && (
                        <p className="truncate text-xs text-slate-500">{rp.permission.description}</p>
                      )}
                    </div>
                    <ScopeBadge scope={rp.scope} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page

function RolesTable({ roles, onOpen }: { roles: Role[]; onOpen: (role: Role) => void }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="px-5 py-3 font-medium">Role</th>
              <th scope="col" className="px-3 py-3 font-medium">Type</th>
              <th scope="col" className="px-3 py-3 font-medium">Access</th>
              <th scope="col" className="px-3 py-3 font-medium">Scope</th>
              <th scope="col" className="px-5 py-3"><span className="sr-only">Details</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {roles.map((role) => {
              const resources = groupByResource(role.permissions, (rp) => rp.permission.resource).map(([r]) => r);
              const scopes = scopesOf(role);
              return (
                <tr
                  key={role.id}
                  onClick={() => onOpen(role)}
                  className="cursor-pointer transition-colors hover:bg-slate-50"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <RoleAvatar isSystem={role.isSystem} />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">{role.name}</p>
                        <p className="max-w-xs truncate text-xs text-slate-500" title={role.description ?? role.key}>
                          {role.description ?? <span className="font-mono">{role.key}</span>}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <RoleTypeBadge isSystem={role.isSystem} />
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-sm text-slate-900">
                      <span className="font-semibold tabular-nums">{role.permissions.length}</span>{' '}
                      <span className="text-slate-500">
                        {role.permissions.length === 1 ? 'permission' : 'permissions'}
                      </span>
                    </p>
                    <p className="mt-0.5 max-w-[16rem] truncate text-xs text-slate-500">
                      {resources.length === 0
                        ? 'No modules'
                        : resources.slice(0, 3).map(humanize).join(', ') +
                          (resources.length > 3 ? ` +${resources.length - 3} more` : '')}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {scopes.length === 0 ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        scopes.slice(0, 2).map((s) => <ScopeBadge key={s} scope={s} />)
                      )}
                      {scopes.length > 2 && (
                        <span className="text-[11px] text-slate-400">+{scopes.length - 2}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(role);
                      }}
                      aria-label={`View ${role.name}`}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                    >
                      View
                      {chevronRight}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function RolesPage() {
  const { hasPermission } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [openRoleId, setOpenRoleId] = useState<string | null>(null);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const canManage = hasPermission('roles.manage');
  const [filter, setFilter] = useState<RoleFilter>('all');
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const rolesQuery = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: async () => (await apiClient.get('/v1/roles')).data,
  });

  const permissionsQuery = useQuery<Permission[]>({
    queryKey: ['permissions'],
    queryFn: async () => (await apiClient.get('/v1/permissions')).data,
    enabled: showForm || editingRoleId !== null,
  });

  const permissions = useMemo(() => permissionsQuery.data ?? [], [permissionsQuery.data]);
  const roles = useMemo(() => rolesQuery.data ?? [], [rolesQuery.data]);
  // Looked up by id so the panels show fresh data after an edit refetches.
  const openRole = roles.find((r) => r.id === openRoleId) ?? null;
  const editingRole = roles.find((r) => r.id === editingRoleId) ?? null;

  const counts = {
    all: roles.length,
    system: roles.filter((r) => r.isSystem).length,
    custom: roles.filter((r) => !r.isSystem).length,
  };

  const visibleRoles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return roles
      .filter((r) => (filter === 'all' ? true : filter === 'system' ? r.isSystem : !r.isSystem))
      .filter(
        (r) =>
          !q ||
          r.name.toLowerCase().includes(q) ||
          r.key.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q),
      )
      .sort((a, b) => Number(a.isSystem) - Number(b.isSystem) || a.name.localeCompare(b.name));
  }, [roles, filter, search]);

  const tabs: { id: RoleFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'custom', label: 'Custom' },
    { id: 'system', label: 'System' },
  ];

  return (
    <div>
      <PageHeader
        title="Roles"
        description="What each role can do, and how far that access reaches."
        action={
          hasPermission('roles.manage') && (
            <Button onClick={() => setShowForm(true)} className="inline-flex shrink-0 items-center gap-1.5">
              {plusIcon}
              New role
            </Button>
          )
        }
      />

      <Drawer open={showForm} onClose={() => setShowForm(false)} title="New role">
        {permissionsQuery.isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        )}
        {permissionsQuery.isError && (
          <ErrorState message="Couldn't load the permission list. Creating roles also needs the permissions.manage permission." />
        )}
        {!permissionsQuery.isLoading && !permissionsQuery.isError && (
          <RoleForm
            permissions={permissions}
            onSaved={() => {
              setShowForm(false);
              queryClient.invalidateQueries({ queryKey: ['roles'] });
            }}
          />
        )}
      </Drawer>

      <Drawer open={openRole !== null} onClose={() => setOpenRoleId(null)} title="Role details">
        {openRole && (
          <RoleDetail
            key={openRole.id}
            role={openRole}
            canManage={canManage}
            onEdit={() => {
              setEditingRoleId(openRole.id);
              setOpenRoleId(null);
            }}
            onDeleted={() => {
              setOpenRoleId(null);
              queryClient.invalidateQueries({ queryKey: ['roles'] });
            }}
          />
        )}
      </Drawer>

      <Drawer open={editingRole !== null} onClose={() => setEditingRoleId(null)} title="Edit role">
        {editingRole && permissionsQuery.isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        )}
        {editingRole && permissionsQuery.isError && (
          <ErrorState message="Couldn't load the permission list. Editing roles also needs the permissions.manage permission." />
        )}
        {editingRole && permissionsQuery.data && (
          <RoleForm
            key={editingRole.id}
            role={editingRole}
            permissions={permissions}
            onSaved={() => {
              const id = editingRole.id;
              setEditingRoleId(null);
              queryClient.invalidateQueries({ queryKey: ['roles'] });
              setOpenRoleId(id);
            }}
          />
        )}
      </Drawer>

      {rolesQuery.isLoading && (
        <Card className="space-y-3 p-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </Card>
      )}
      {rolesQuery.isError && <ErrorState message="Couldn't load roles. Refresh the page to try again." />}
      {rolesQuery.data && roles.length === 0 && (
        <EmptyState title="No roles yet" description="Create a role to start granting access." />
      )}

      {roles.length > 0 && (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex rounded-lg bg-slate-100 p-1" role="group" aria-label="Filter roles">
              {tabs.map((tab) => {
                const active = filter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(tab.id)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${
                      active ? 'bg-red-700 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                    <span className={`ml-1.5 tabular-nums ${active ? 'text-red-100' : 'text-slate-400'}`}>
                      {counts[tab.id]}
                    </span>
                  </button>
                );
              })}
            </div>
            <label className="relative block sm:w-72">
              <span className="sr-only">Search roles</span>
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                {baseIcons.search}
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search roles"
                className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-red-600 focus:outline-none"
              />
            </label>
          </div>

          {visibleRoles.length === 0 ? (
            <EmptyState
              title="No matching roles"
              description={
                search ? `Nothing matches “${search}”.` : filter === 'custom' ? 'No custom roles yet.' : 'No roles in this view.'
              }
            />
          ) : (
            <RolesTable roles={visibleRoles} onOpen={(r) => setOpenRoleId(r.id)} />
          )}
        </>
      )}
    </div>
  );
}
