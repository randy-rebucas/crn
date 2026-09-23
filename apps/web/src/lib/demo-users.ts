// Demo identities for exercising RBAC in the UI without a live backend.
// Permission keys mirror what the dashboard pages actually check via hasPermission().

export interface DemoPermission {
  key: string;
  scope: 'global' | 'organization' | 'branch' | 'assigned' | 'self';
}

export interface DemoUser {
  id: string;
  organizationId: string;
  email: string;
  password: string;
  name: string;
  roles: string[];
  branchIds: string[];
  permissions: DemoPermission[];
}

const ORG_ID = 'org-obias';
const BRANCH_MAIN = 'branch-main';
const BRANCH_NORTH = 'branch-north';

const perms = (keys: string[], scope: DemoPermission['scope'] = 'global'): DemoPermission[] =>
  keys.map((key) => ({ key, scope }));

const ALL_PERMISSION_KEYS = [
  'students.view', 'students.create', 'students.update', 'students.archive', 'students.export',
  'enrollments.view', 'enrollments.update',
  'programs.view', 'programs.create', 'programs.publish', 'programs.archive',
  'courses.view', 'courses.create',
  'classes.view', 'classes.create',
  'rooms.view', 'rooms.create',
  'schedules.view', 'schedules.create',
  'attendance.view', 'attendance.create',
  'exams.view', 'exams.create', 'exams.update', 'exams.approve', 'exams.publish', 'exams.grade',
  'payments.view', 'payments.create', 'payments.verify',
  'pricing.create',
  'invoices.create',
  'refunds.create', 'refunds.officer_approve', 'refunds.manager_approve', 'refunds.process',
  'leads.view', 'leads.create', 'leads.update',
  'reports.view', 'reports.export',
  'users.manage', 'roles.manage', 'permissions.manage', 'audit_logs.view',
];

export const DEMO_PASSWORD = 'Passw0rd!';

// Next.js inlines NEXT_PUBLIC_* references to a literal at build time, so
// when mocks are off this becomes `false ? [...] : []` and the minifier
// drops the whole demo-account literal (names, emails, the shared password)
// from the production bundle rather than just skipping it at runtime.
export const DEMO_USERS: DemoUser[] =
  process.env.NEXT_PUBLIC_USE_MOCKS === 'true'
    ? [
  {
    id: 'user-super-admin',
    organizationId: ORG_ID,
    email: 'superadmin@obias.demo',
    password: DEMO_PASSWORD,
    name: 'Sam Reyes',
    roles: ['Super Admin'],
    branchIds: [BRANCH_MAIN, BRANCH_NORTH],
    permissions: perms(ALL_PERMISSION_KEYS, 'global'),
  },
  {
    id: 'user-branch-manager',
    organizationId: ORG_ID,
    email: 'branchmanager@obias.demo',
    password: DEMO_PASSWORD,
    name: 'Bea Manalo',
    roles: ['Branch Manager'],
    branchIds: [BRANCH_MAIN],
    permissions: perms(
      [
        'students.view', 'students.create', 'students.update',
        'enrollments.view', 'enrollments.update',
        'programs.view', 'courses.view',
        'classes.view', 'classes.create', 'rooms.view', 'rooms.create',
        'schedules.view', 'schedules.create',
        'attendance.view', 'attendance.create',
        'exams.view',
        'payments.view',
        'leads.view', 'leads.create', 'leads.update',
        'reports.view',
      ],
      'branch',
    ),
  },
  {
    id: 'user-academic-director',
    organizationId: ORG_ID,
    email: 'academicdirector@obias.demo',
    password: DEMO_PASSWORD,
    name: 'Dr. Ana Cruz',
    roles: ['Academic Director'],
    branchIds: [BRANCH_MAIN, BRANCH_NORTH],
    permissions: perms(
      [
        'programs.view', 'programs.create', 'programs.publish', 'programs.archive',
        'courses.view', 'courses.create',
        'exams.view', 'exams.create', 'exams.update', 'exams.approve', 'exams.publish',
        'reports.view', 'reports.export',
      ],
      'organization',
    ),
  },
  {
    id: 'user-instructor',
    organizationId: ORG_ID,
    email: 'instructor@obias.demo',
    password: DEMO_PASSWORD,
    name: 'James Ortiz',
    roles: ['Instructor'],
    branchIds: [BRANCH_MAIN],
    permissions: [
      ...perms(['classes.view', 'attendance.view', 'attendance.create', 'exams.view', 'exams.grade'], 'assigned'),
      ...perms(['students.view'], 'assigned'),
    ],
  },
  {
    id: 'user-registrar',
    organizationId: ORG_ID,
    email: 'registrar@obias.demo',
    password: DEMO_PASSWORD,
    name: 'Nora Villanueva',
    roles: ['Registrar'],
    branchIds: [BRANCH_MAIN],
    permissions: perms(
      ['students.view', 'students.create', 'students.update', 'enrollments.view', 'enrollments.update', 'leads.view'],
      'branch',
    ),
  },
  {
    id: 'user-admissions-officer',
    organizationId: ORG_ID,
    email: 'admissions@obias.demo',
    password: DEMO_PASSWORD,
    name: 'Kevin Santos',
    roles: ['Admissions Officer'],
    branchIds: [BRANCH_MAIN],
    permissions: perms(['leads.view', 'leads.create', 'leads.update', 'enrollments.view'], 'branch'),
  },
  {
    id: 'user-finance-manager',
    organizationId: ORG_ID,
    email: 'financemanager@obias.demo',
    password: DEMO_PASSWORD,
    name: 'Patricia Lim',
    roles: ['Finance Manager'],
    branchIds: [BRANCH_MAIN, BRANCH_NORTH],
    permissions: perms(
      [
        'payments.view', 'payments.create', 'payments.verify',
        'pricing.create', 'invoices.create',
        'refunds.create', 'refunds.manager_approve', 'refunds.process',
        'reports.view', 'reports.export',
      ],
      'organization',
    ),
  },
  {
    id: 'user-finance-officer',
    organizationId: ORG_ID,
    email: 'financeofficer@obias.demo',
    password: DEMO_PASSWORD,
    name: 'Carlo Dizon',
    roles: ['Finance Officer'],
    branchIds: [BRANCH_MAIN],
    permissions: perms(['payments.view', 'payments.create', 'refunds.create', 'refunds.officer_approve'], 'branch'),
  },
  {
    id: 'user-front-desk',
    organizationId: ORG_ID,
    email: 'frontdesk@obias.demo',
    password: DEMO_PASSWORD,
    name: 'Ella Fernandez',
    roles: ['Front Desk Staff'],
    branchIds: [BRANCH_MAIN],
    permissions: perms(['students.view', 'leads.view', 'leads.create', 'schedules.view'], 'branch'),
  },
  {
    id: 'user-auditor',
    organizationId: ORG_ID,
    email: 'auditor@obias.demo',
    password: DEMO_PASSWORD,
    name: 'Rafael Ignacio',
    roles: ['Auditor'],
    branchIds: [BRANCH_MAIN, BRANCH_NORTH],
    permissions: perms(['audit_logs.view', 'reports.view', 'students.view', 'payments.view'], 'global'),
  },
  {
    id: 'user-student',
    organizationId: ORG_ID,
    email: 'student@obias.demo',
    password: DEMO_PASSWORD,
    name: 'Mika Torres',
    roles: ['Student'],
    branchIds: [BRANCH_MAIN],
    permissions: perms(['results.view', 'exams.view'], 'self'),
  },
    ]
    : [];

export function findDemoUser(email: string, password: string): DemoUser | undefined {
  return DEMO_USERS.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password,
  );
}

export function findDemoUserById(id: string): DemoUser | undefined {
  return DEMO_USERS.find((u) => u.id === id);
}
