import { PrismaClient, PermissionScope } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const PERMISSIONS: { key: string; resource: string; action: string }[] = [
  'students.view,students.create,students.update,students.archive,students.export',
  'programs.view,programs.create,programs.update,programs.publish,programs.archive',
  'courses.view,courses.create,courses.update,courses.publish',
  'exams.view,exams.create,exams.update,exams.approve,exams.publish,exams.grade',
  'payments.view,payments.create,payments.verify',
  // Split from a single `refunds.approve` into two distinct steps of the
  // approval chain (blueprint Section 25: Officer -> Manager -> Process) —
  // previously both steps were gated by the same key, so there was no way
  // to actually separate "can approve as officer" from "can approve as
  // manager" at the role level. Kept `refunds.approve` around (not
  // removed) since old role grants referencing it shouldn't silently break.
  'refunds.create,refunds.approve,refunds.officer_approve,refunds.manager_approve',
  'reports.view,reports.export',
  'users.manage,roles.manage,permissions.manage,audit_logs.view',
  'organizations.view,organizations.create',
  'branches.view,branches.create',
  'enrollments.view,enrollments.create,enrollments.update,enrollments.approve',
  'instructors.view,instructors.create,instructors.update',
  'batches.view,batches.create,batches.update',
  'rooms.view,rooms.create,rooms.update',
  'classes.view,classes.create,classes.update',
  'schedules.view,schedules.create,schedules.update',
  'attendance.view,attendance.create,attendance.update',
  'pricing.view,pricing.create',
  'invoices.view,invoices.create',
  'refunds.view,refunds.process',
  'certificates.view,certificates.issue',
  'leads.view,leads.create,leads.update',
  'progress.view',
  'settings.view,settings.manage',
  'admissions.view,admissions.create,admissions.review',
  'staff.view,staff.create,staff.update',
  'requirements.view,requirements.manage,requirements.submit,requirements.review',
  'content.view,content.manage',
]
  .join(',')
  .split(',')
  .map((key) => {
    const [resource, action] = key.split('.');
    return { key, resource, action };
  });

// Segregation of duties: refunds.officer_approve and refunds.manager_approve
// gate the two distinct steps of the same approval chain (blueprint Section
// 25) and must never be granted to the same role — otherwise one person
// could self-approve a refund end to end. super_admin is the sole,
// deliberate exception (it is the organization's full-access break-glass
// role, not a workflow participant).
const SOD_CONFLICTS: [string, string][] = [['refunds.officer_approve', 'refunds.manager_approve']];

function assertNoSodConflict(roleKey: string, permissionKeys: string[]) {
  if (roleKey === 'super_admin') return;
  const held = new Set(permissionKeys);
  for (const [a, b] of SOD_CONFLICTS) {
    if (held.has(a) && held.has(b)) {
      throw new Error(
        `Segregation-of-duties violation: role "${roleKey}" cannot hold both "${a}" and "${b}"`,
      );
    }
  }
}

interface RoleSeed {
  key: string;
  name: string;
  category: string;
  scope: PermissionScope;
  permissionKeys: string[];
}

// Role catalog per PRODUCT spec "Primary Users" section. Organizations may
// still layer on custom roles via the /v1/roles API — these are the
// system-defined baseline roles (isSystem: true) so the RBAC model has
// something real to enforce out of the box instead of everyone defaulting
// to super_admin in practice.
const ROLE_CATALOG: RoleSeed[] = [
  // --- Platform / Executive ---------------------------------------------
  // super_admin handled separately below (gets every permission at GLOBAL).
  {
    key: 'owner_executive',
    name: 'Owner / Executive',
    category: 'Platform / Executive',
    scope: PermissionScope.ORGANIZATION,
    permissionKeys: [
      'organizations.view',
      'branches.view',
      'students.view',
      'programs.view',
      'courses.view',
      'exams.view',
      'payments.view',
      'invoices.view',
      'refunds.view',
      'enrollments.view',
      'staff.view',
      'settings.view',
      'audit_logs.view',
      'reports.view',
      'reports.export',
      'content.view',
      'content.manage',
    ],
  },
  {
    key: 'operations_manager',
    name: 'Operations Manager',
    category: 'Platform / Executive',
    scope: PermissionScope.ORGANIZATION,
    permissionKeys: [
      'branches.view',
      'branches.create',
      'batches.view',
      'batches.create',
      'batches.update',
      'rooms.view',
      'rooms.create',
      'rooms.update',
      'classes.view',
      'classes.create',
      'classes.update',
      'schedules.view',
      'schedules.create',
      'schedules.update',
      'enrollments.view',
      'enrollments.approve',
      'students.view',
      'staff.view',
      'reports.view',
    ],
  },

  // --- Academic ------------------------------------------------------------
  {
    key: 'academic_director',
    name: 'Academic Director',
    category: 'Academic',
    scope: PermissionScope.ORGANIZATION,
    permissionKeys: [
      'programs.view',
      'programs.create',
      'programs.update',
      'programs.publish',
      'programs.archive',
      'courses.view',
      'courses.create',
      'courses.update',
      'courses.publish',
      'exams.view',
      'exams.approve',
      'exams.publish',
      'instructors.view',
      'instructors.create',
      'instructors.update',
      'reports.view',
      'requirements.manage',
      'requirements.view',
    ],
  },
  {
    key: 'lead_instructor',
    name: 'Lead Instructor',
    category: 'Academic',
    scope: PermissionScope.BRANCH,
    permissionKeys: [
      'courses.view',
      'courses.update',
      'exams.view',
      'exams.create',
      'exams.update',
      'exams.grade',
      'classes.view',
      'classes.update',
      'attendance.view',
      'attendance.create',
      'attendance.update',
      'students.view',
    ],
  },
  {
    key: 'instructor',
    name: 'Instructor',
    category: 'Academic',
    scope: PermissionScope.ASSIGNED,
    permissionKeys: [
      'courses.view',
      'exams.view',
      'exams.grade',
      'classes.view',
      'attendance.view',
      'attendance.create',
      'attendance.update',
      'students.view',
    ],
  },
  {
    key: 'content_manager',
    name: 'Content Manager',
    category: 'Academic',
    scope: PermissionScope.ORGANIZATION,
    permissionKeys: ['courses.view', 'courses.create', 'courses.update', 'courses.publish', 'programs.view', 'programs.update'],
  },
  {
    key: 'exam_administrator',
    name: 'Exam Administrator',
    category: 'Academic',
    scope: PermissionScope.ORGANIZATION,
    permissionKeys: [
      'exams.view',
      'exams.create',
      'exams.update',
      'exams.approve',
      'exams.publish',
      'courses.view',
    ],
  },

  // --- Operations ------------------------------------------------------------
  // branch_manager handled separately below (kept for backward compatibility
  // with the existing seed).
  {
    key: 'registrar',
    name: 'Registrar',
    category: 'Operations',
    scope: PermissionScope.BRANCH,
    permissionKeys: [
      'students.view',
      'students.create',
      'students.update',
      'enrollments.view',
      'enrollments.create',
      'enrollments.update',
      'certificates.view',
      'certificates.issue',
      'batches.view',
      'classes.view',
      'requirements.view',
      'requirements.review',
    ],
  },
  {
    key: 'admissions_officer',
    name: 'Admissions Officer',
    category: 'Operations',
    scope: PermissionScope.BRANCH,
    permissionKeys: [
      'admissions.view',
      'admissions.create',
      'admissions.review',
      'leads.view',
      'leads.create',
      'leads.update',
      'students.view',
      'students.create',
      'enrollments.create',
      'requirements.view',
      'requirements.review',
    ],
  },
  {
    key: 'front_desk_staff',
    name: 'Front Desk Staff',
    category: 'Operations',
    scope: PermissionScope.BRANCH,
    permissionKeys: ['leads.view', 'leads.create', 'students.view', 'enrollments.view', 'attendance.view'],
  },
  {
    key: 'general_staff',
    name: 'General Staff',
    category: 'Operations',
    scope: PermissionScope.BRANCH,
    permissionKeys: ['students.view', 'attendance.view'],
  },

  // --- Finance ------------------------------------------------------------
  {
    key: 'finance_manager',
    name: 'Finance Manager',
    category: 'Finance',
    scope: PermissionScope.BRANCH,
    permissionKeys: [
      'payments.view',
      'payments.verify',
      'invoices.view',
      'invoices.create',
      'refunds.view',
      'refunds.manager_approve',
      'refunds.process',
      'pricing.view',
      'pricing.create',
      'reports.view',
      'reports.export',
    ],
  },
  {
    key: 'finance_officer',
    name: 'Finance Officer',
    category: 'Finance',
    scope: PermissionScope.BRANCH,
    permissionKeys: [
      'payments.view',
      'payments.create',
      'payments.verify',
      'invoices.view',
      'invoices.create',
      'refunds.view',
      'refunds.officer_approve',
      'pricing.view',
    ],
  },
  {
    key: 'cashier',
    name: 'Cashier',
    category: 'Finance',
    scope: PermissionScope.BRANCH,
    permissionKeys: ['payments.view', 'payments.create', 'invoices.view', 'refunds.create'],
  },

  // --- Human Resources ------------------------------------------------------------
  {
    key: 'hr_manager',
    name: 'HR Manager',
    category: 'Human Resources',
    scope: PermissionScope.ORGANIZATION,
    permissionKeys: ['staff.view', 'staff.create', 'staff.update', 'users.manage', 'settings.view'],
  },
  {
    key: 'hr_staff',
    name: 'HR Staff',
    category: 'Human Resources',
    scope: PermissionScope.ORGANIZATION,
    permissionKeys: ['staff.view', 'staff.create', 'staff.update'],
  },

  // --- Compliance ------------------------------------------------------------
  {
    key: 'auditor',
    name: 'Auditor',
    category: 'Compliance',
    scope: PermissionScope.ORGANIZATION,
    permissionKeys: [
      // Deliberately read-only: an auditor must never hold create/update/
      // approve/manage permissions, or it stops being an independent check.
      'audit_logs.view',
      'reports.view',
      'reports.export',
      'students.view',
      'payments.view',
      'invoices.view',
      'refunds.view',
      'exams.view',
      'enrollments.view',
      'settings.view',
    ],
  },

  // Note: "Parent / Guardian" is listed in the product spec as an optional
  // future role, and there is no parent<->student linkage model yet
  // (schema has no guardian relation). Seeding it now would grant a role
  // with permissions but no data-scoping mechanism to actually restrict it
  // to a linked student, which is worse than not having it. Add once the
  // linkage model exists.
];

async function main() {
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: {},
      create: permission,
    });
  }

  const org = await prisma.organization.upsert({
    where: { slug: 'obias' },
    update: {},
    create: { name: 'OBIAS Nursing & Allied Courses Review Center', slug: 'obias' },
  });

  const mainBranch = await prisma.branch.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'MAIN' } },
    update: {},
    create: { organizationId: org.id, name: 'Main Branch', code: 'MAIN' },
  });

  const secondBranch = await prisma.branch.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'NORTH' } },
    update: {},
    create: { organizationId: org.id, name: 'North Branch', code: 'NORTH' },
  });

  const allPermissionRows = await prisma.permission.findMany();
  const permissionByKey = new Map(allPermissionRows.map((p) => [p.key, p]));

  async function upsertRole(roleKey: string, name: string, scope: PermissionScope, permissionKeys: string[]) {
    assertNoSodConflict(roleKey, permissionKeys);

    const role = await prisma.role.upsert({
      where: { organizationId_key: { organizationId: org.id, key: roleKey } },
      update: {},
      create: { organizationId: org.id, key: roleKey, name, isSystem: true },
    });

    for (const key of permissionKeys) {
      const permission = permissionByKey.get(key);
      if (!permission) throw new Error(`Unknown permission key in role "${roleKey}": ${key}`);
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: { scope },
        create: { roleId: role.id, permissionId: permission.id, scope },
      });
    }

    return role;
  }

  const superAdminRole = await upsertRole(
    'super_admin',
    'Super Admin',
    PermissionScope.GLOBAL,
    allPermissionRows.map((p) => p.key),
  );

  const studentRole = await upsertRole('student', 'Student', PermissionScope.SELF, [
    'students.view',
    'programs.view',
    'courses.view',
    'exams.view',
    'attendance.view',
    'enrollments.view',
    'progress.view',
    'requirements.view',
    'requirements.submit',
  ]);

  const branchManagerRole = await upsertRole('branch_manager', 'Branch Manager', PermissionScope.BRANCH, [
    'students.view',
    'enrollments.view',
    'attendance.view',
  ]);

  for (const roleSeed of ROLE_CATALOG) {
    await upsertRole(roleSeed.key, roleSeed.name, roleSeed.scope, roleSeed.permissionKeys);
  }

  const passwordHash = await argon2.hash('ChangeMe123!');

  const superAdminUser = await prisma.user.upsert({
    where: { email: 'admin@obias.local' },
    update: {},
    create: {
      organizationId: org.id,
      email: 'admin@obias.local',
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      branches: { create: [{ branchId: mainBranch.id }] },
      roles: { create: [{ roleId: superAdminRole.id }] },
    },
  });

  const northManagerUser = await prisma.user.upsert({
    where: { email: 'north.manager@obias.local' },
    update: {},
    create: {
      organizationId: org.id,
      email: 'north.manager@obias.local',
      passwordHash,
      firstName: 'North',
      lastName: 'Manager',
      branches: { create: [{ branchId: secondBranch.id }] },
      roles: { create: [{ roleId: branchManagerRole.id }] },
    },
  });

  console.log('Seeded organization:', org.slug);
  console.log('Seeded roles:', 3 + ROLE_CATALOG.length);
  console.log('Seeded super admin:', superAdminUser.email, '(password: ChangeMe123!)');
  console.log('Seeded branch manager:', northManagerUser.email, '(password: ChangeMe123!, branch: NORTH)');
  console.log('Seeded student role permission holder key:', studentRole.key);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
