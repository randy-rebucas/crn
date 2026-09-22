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
]
  .join(',')
  .split(',')
  .map((key) => {
    const [resource, action] = key.split('.');
    return { key, resource, action };
  });

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

  const allPermissionRows = await prisma.permission.findMany();

  const superAdminRole = await prisma.role.upsert({
    where: { organizationId_key: { organizationId: org.id, key: 'super_admin' } },
    update: {},
    create: {
      organizationId: org.id,
      key: 'super_admin',
      name: 'Super Admin',
      isSystem: true,
      permissions: {
        create: allPermissionRows.map((p) => ({ permissionId: p.id, scope: PermissionScope.GLOBAL })),
      },
    },
  });

  // Backfill any permission created after super_admin already existed (idempotent re-seed).
  for (const permission of allPermissionRows) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: superAdminRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: superAdminRole.id, permissionId: permission.id, scope: PermissionScope.GLOBAL },
    });
  }

  const studentPermissionKeys = [
    'students.view',
    'programs.view',
    'courses.view',
    'exams.view',
    'attendance.view',
    'enrollments.view',
  ];
  const studentPermissionRows = await prisma.permission.findMany({
    where: { key: { in: studentPermissionKeys } },
  });

  const studentRole = await prisma.role.upsert({
    where: { organizationId_key: { organizationId: org.id, key: 'student' } },
    update: {},
    create: {
      organizationId: org.id,
      key: 'student',
      name: 'Student',
      isSystem: true,
      permissions: {
        create: studentPermissionRows.map((p) => ({ permissionId: p.id, scope: PermissionScope.SELF })),
      },
    },
  });

  for (const permission of studentPermissionRows) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: studentRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: studentRole.id, permissionId: permission.id, scope: PermissionScope.SELF },
    });
  }

  const secondBranch = await prisma.branch.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'NORTH' } },
    update: {},
    create: { organizationId: org.id, name: 'North Branch', code: 'NORTH' },
  });

  const branchManagerPermissionKeys = ['students.view', 'enrollments.view', 'attendance.view'];
  const branchManagerPermissionRows = await prisma.permission.findMany({
    where: { key: { in: branchManagerPermissionKeys } },
  });

  const branchManagerRole = await prisma.role.upsert({
    where: { organizationId_key: { organizationId: org.id, key: 'branch_manager' } },
    update: {},
    create: {
      organizationId: org.id,
      key: 'branch_manager',
      name: 'Branch Manager',
      isSystem: true,
      permissions: {
        create: branchManagerPermissionRows.map((p) => ({
          permissionId: p.id,
          scope: PermissionScope.BRANCH,
        })),
      },
    },
  });

  for (const permission of branchManagerPermissionRows) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: branchManagerRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: branchManagerRole.id, permissionId: permission.id, scope: PermissionScope.BRANCH },
    });
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
  console.log('Seeded super admin:', superAdminUser.email, '(password: ChangeMe123!)');
  console.log('Seeded branch manager:', northManagerUser.email, '(password: ChangeMe123!, branch: NORTH)');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
