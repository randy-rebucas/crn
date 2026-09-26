'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { humanize } from '@/lib/format';
import { useAuth } from '@/lib/auth-context';
import { Card, EmptyState, ErrorState, PageHeader } from '@/components/ui';
import { icons as baseIcons } from '@/components/student-ui';
import { adminIcons } from '@/components/admin-shell';

interface Permission {
  id: string;
  key: string;
  resource: string;
  action: string;
  description: string | null;
}

interface Role {
  id: string;
  name: string;
  permissions: { permission: { key: string } }[];
}

// How much damage a grant can do, judged from its action verb. Read = look
// only; Write = everyday data entry; Sensitive = approvals, money movement,
// exports and admin control — the ones worth a second look when building a role.
type Level = 'read' | 'write' | 'sensitive';
const SENSITIVE_ACTIONS = new Set([
  'manage',
  'approve',
  'officer_approve',
  'manager_approve',
  'verify',
  'process',
  'issue',
  'export',
]);

function levelOf(action: string): Level {
  if (action === 'view') return 'read';
  if (SENSITIVE_ACTIONS.has(action)) return 'sensitive';
  return 'write';
}

const LEVELS: Record<Level, { label: string; dot: string; pill: string; hint: string }> = {
  read: {
    label: 'Read',
    dot: 'bg-slate-400',
    pill: 'bg-slate-100 text-slate-700',
    hint: 'Can look, not change',
  },
  write: {
    label: 'Write',
    dot: 'bg-amber-400',
    pill: 'bg-amber-100 text-amber-800',
    hint: 'Creates or edits records',
  },
  sensitive: {
    label: 'Sensitive',
    dot: 'bg-red-700',
    pill: 'bg-red-100 text-red-700',
    hint: 'Approvals, money, exports or admin control',
  },
};

// Mirrors SOD_CONFLICTS in apps/api/prisma/seed.ts — pairs a single role
// must never hold together.
const SOD_PAIRS: [string, string][] = [['refunds.officer_approve', 'refunds.manager_approve']];
const sodPartner = new Map(SOD_PAIRS.flatMap(([a, b]) => [[a, b], [b, a]] as [string, string][]));

// Modules grouped into the areas staff think in. Anything not listed falls
// into "Other" so a newly seeded resource still shows up.
const AREAS: { id: string; title: string; description: string; resources: string[] }[] = [
  {
    id: 'admissions',
    title: 'Students & admissions',
    description: 'From first inquiry to enrolled reviewee',
    resources: ['leads', 'admissions', 'requirements', 'enrollments', 'students'],
  },
  {
    id: 'academics',
    title: 'Academics',
    description: 'Programs, classes, exams and learning content',
    resources: [
      'programs',
      'courses',
      'batches',
      'classes',
      'rooms',
      'schedules',
      'attendance',
      'exams',
      'progress',
      'content',
      'certificates',
    ],
  },
  {
    id: 'finance',
    title: 'Finance',
    description: 'Pricing, billing, payments and refunds',
    resources: ['pricing', 'invoices', 'payments', 'refunds'],
  },
  {
    id: 'people',
    title: 'People',
    description: 'Staff, instructors and user accounts',
    resources: ['staff', 'instructors', 'users'],
  },
  {
    id: 'administration',
    title: 'Administration',
    description: 'Organization setup, access control and oversight',
    resources: ['organizations', 'branches', 'settings', 'roles', 'permissions', 'audit_logs', 'reports'],
  },
];

const MODULE_ICONS: Record<string, React.ReactNode> = {
  leads: adminIcons.userPlus,
  admissions: adminIcons.clipboardCheck,
  requirements: adminIcons.fileText,
  enrollments: adminIcons.userPlus,
  students: adminIcons.users,
  programs: adminIcons.layers,
  courses: baseIcons.learn,
  batches: adminIcons.layers,
  classes: adminIcons.grid,
  rooms: adminIcons.mapPin,
  schedules: baseIcons.schedule,
  attendance: adminIcons.checkSquare,
  exams: baseIcons.exams,
  progress: baseIcons.progress,
  content: adminIcons.fileText,
  certificates: baseIcons.certificate,
  pricing: adminIcons.creditCard,
  invoices: adminIcons.fileText,
  payments: adminIcons.creditCard,
  refunds: adminIcons.history,
  staff: adminIcons.users,
  instructors: baseIcons.profile,
  users: adminIcons.users,
  organizations: adminIcons.grid,
  branches: adminIcons.mapPin,
  settings: baseIcons.settings,
  roles: adminIcons.shield,
  permissions: adminIcons.key,
  audit_logs: adminIcons.history,
  reports: adminIcons.pieChart,
};

// The catalog has no descriptions yet, so derive a readable sentence from
// the key: "enrollments.approve" -> "Approve enrollments".
function describe(p: Permission) {
  return p.description ?? `${humanize(p.action)} ${p.resource.replace(/_/g, ' ')}`;
}

type LevelFilter = 'all' | Level;

function LevelPill({ level }: { level: Level }) {
  const meta = LEVELS[level];
  return (
    <span
      title={meta.hint}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.pill}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function ModuleCard({
  resource,
  permissions,
  holders,
}: {
  resource: string;
  permissions: Permission[];
  holders: Map<string, string[]> | null;
}) {
  const levelCounts = { read: 0, write: 0, sensitive: 0 };
  for (const p of permissions) levelCounts[levelOf(p.action)] += 1;

  return (
    <Card className="overflow-hidden">
      <div id={`module-${resource}`} className="flex scroll-mt-24 items-center gap-3 border-b border-slate-100 px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-700 [&_svg]:h-4 [&_svg]:w-4">
          {MODULE_ICONS[resource] ?? adminIcons.key}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-900">{humanize(resource)}</h3>
          <p className="text-xs text-slate-500">
            {permissions.length} {permissions.length === 1 ? 'permission' : 'permissions'}
          </p>
        </div>
        <div className="flex h-1.5 w-16 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
          {(['read', 'write', 'sensitive'] as Level[]).map((level) =>
            levelCounts[level] > 0 ? (
              <span
                key={level}
                className={LEVELS[level].dot}
                style={{ width: `${(levelCounts[level] / permissions.length) * 100}%` }}
              />
            ) : null,
          )}
        </div>
      </div>
      <ul className="divide-y divide-slate-50">
        {permissions.map((p) => {
          const roles = holders?.get(p.key) ?? [];
          const partner = sodPartner.get(p.key);
          return (
            <li key={p.id} className="flex items-start gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-900">{describe(p)}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                  <code className="font-mono text-[11px] text-slate-500">{p.key}</code>
                  {holders && (
                    <span
                      title={roles.length ? roles.join(', ') : undefined}
                      className={roles.length ? 'text-slate-500' : 'text-slate-400'}
                    >
                      · {roles.length === 0 ? 'No roles' : roles.length === 1 ? roles[0] : `${roles.length} roles`}
                    </span>
                  )}
                </p>
                {partner && (
                  <p className="mt-1 text-xs text-amber-700">
                    Never grant together with <code className="font-mono text-[11px]">{partner}</code> (separation of duties).
                  </p>
                )}
              </div>
              <LevelPill level={levelOf(p.action)} />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export default function PermissionsPage() {
  const { hasPermission } = useAuth();
  const canSeeRoles = hasPermission('roles.manage');
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');

  const permissionsQuery = useQuery<Permission[]>({
    queryKey: ['permissions'],
    queryFn: async () => (await apiClient.get('/v1/permissions')).data,
  });

  // Same ['roles'] cache the Roles page uses; only fetched when the viewer
  // is allowed to see roles, otherwise the "held by" line is left out.
  const rolesQuery = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: async () => (await apiClient.get('/v1/roles')).data,
    enabled: canSeeRoles,
  });

  const holders = useMemo(() => {
    if (!rolesQuery.data) return null;
    const map = new Map<string, string[]>();
    for (const role of rolesQuery.data) {
      for (const rp of role.permissions) {
        map.set(rp.permission.key, [...(map.get(rp.permission.key) ?? []), role.name]);
      }
    }
    return map;
  }, [rolesQuery.data]);

  const all = useMemo(() => permissionsQuery.data ?? [], [permissionsQuery.data]);

  const levelCounts = useMemo(() => {
    const counts: Record<LevelFilter, number> = { all: all.length, read: 0, write: 0, sensitive: 0 };
    for (const p of all) counts[levelOf(p.action)] += 1;
    return counts;
  }, [all]);

  const areas = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = all.filter(
      (p) =>
        (levelFilter === 'all' || levelOf(p.action) === levelFilter) &&
        (!term ||
          p.key.toLowerCase().includes(term) ||
          describe(p).toLowerCase().includes(term)),
    );
    const byResource = new Map<string, Permission[]>();
    for (const p of filtered) byResource.set(p.resource, [...(byResource.get(p.resource) ?? []), p]);

    const known = new Set(AREAS.flatMap((a) => a.resources));
    const other = Array.from(byResource.keys())
      .filter((r) => !known.has(r))
      .sort();
    return [
      ...AREAS,
      { id: 'other', title: 'Other', description: 'Modules not yet grouped into an area', resources: other },
    ]
      .map((area) => ({
        ...area,
        modules: area.resources
          .filter((r) => byResource.has(r))
          .map((r) => ({ resource: r, permissions: byResource.get(r) ?? [] })),
      }))
      .filter((area) => area.modules.length > 0);
  }, [all, search, levelFilter]);

  const moduleCount = new Set(all.map((p) => p.resource)).size;
  const tabs: LevelFilter[] = ['all', 'read', 'write', 'sensitive'];

  return (
    <div>
      <PageHeader
        title="Permissions"
        description="Every action a role can be granted, grouped by where it applies."
      />

      {permissionsQuery.isLoading && (
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      )}
      {permissionsQuery.isError && (
        <ErrorState message="Couldn't load the permission catalog. Refresh the page to try again." />
      )}
      {permissionsQuery.data && all.length === 0 && (
        <EmptyState title="No permissions defined" description="Run the database seed to load the catalog." />
      )}

      {all.length > 0 && (
        <>
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex flex-wrap rounded-lg bg-slate-100 p-1" role="group" aria-label="Filter by access level">
              {tabs.map((id) => {
                const active = levelFilter === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={active}
                    title={id === 'all' ? undefined : LEVELS[id].hint}
                    onClick={() => setLevelFilter(id)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${
                      active ? 'bg-red-700 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {id !== 'all' && (
                      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-white' : LEVELS[id].dot}`} />
                    )}
                    {id === 'all' ? 'All' : LEVELS[id].label}
                    <span className={`tabular-nums ${active ? 'text-red-100' : 'text-slate-400'}`}>{levelCounts[id]}</span>
                  </button>
                );
              })}
            </div>
            <label className="relative block sm:w-72">
              <span className="sr-only">Search permissions</span>
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                {baseIcons.search}
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search, e.g. approve or exams"
                className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-red-600 focus:outline-none"
              />
            </label>
          </div>

          <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
            <nav aria-label="Modules" className="hidden lg:block">
              <div className="sticky top-6 space-y-5">
                <p className="text-xs text-slate-500">
                  <span className="font-semibold tabular-nums text-slate-900">{levelCounts.all}</span> permissions across{' '}
                  <span className="font-semibold tabular-nums text-slate-900">{moduleCount}</span> modules
                </p>
                {areas.map((area) => (
                  <div key={area.id}>
                    <p className="mb-1.5 text-xs font-semibold text-slate-900">{area.title}</p>
                    <ul className="space-y-0.5 border-l border-slate-200">
                      {area.modules.map((m) => (
                        <li key={m.resource}>
                          <a
                            href={`#module-${m.resource}`}
                            className="-ml-px flex items-center justify-between border-l border-transparent py-1 pl-3 pr-1 text-xs text-slate-600 hover:border-red-700 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-red-600"
                          >
                            <span className="truncate">{humanize(m.resource)}</span>
                            <span className="tabular-nums text-slate-400">{m.permissions.length}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </nav>

            <div className="min-w-0 space-y-10">
              {areas.length === 0 && (
                <EmptyState
                  title="No matching permissions"
                  description={search ? `Nothing matches “${search}” at this access level.` : 'Nothing at this access level.'}
                />
              )}
              {areas.map((area) => (
                <section key={area.id} aria-labelledby={`area-${area.id}`}>
                  <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-slate-200 pb-2">
                    <div>
                      <h2 id={`area-${area.id}`} className="text-base font-semibold text-slate-900">
                        {area.title}
                      </h2>
                      <p className="text-xs text-slate-500">{area.description}</p>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-slate-400">
                      {area.modules.reduce((sum, m) => sum + m.permissions.length, 0)} permissions
                    </span>
                  </div>
                  <div className="grid items-start gap-4 xl:grid-cols-2">
                    {area.modules.map((m) => (
                      <ModuleCard key={m.resource} resource={m.resource} permissions={m.permissions} holders={holders} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
