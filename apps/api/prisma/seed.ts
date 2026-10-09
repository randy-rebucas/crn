import { PrismaClient, PermissionScope } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';

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

  // Real contact details (see apps/web/PRODUCT.md) so the public site's
  // footer and contact page render from Settings on a fresh database.
  // `update: {}` — never overwrite what an admin has since edited.
  await prisma.organizationSettings.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      supportEmail: 'centerofreviewfornursing@gmail.com',
      supportPhone: '0917 165 4780',
      additionalPhones: ['0939 126 2602', '0951 562 4048', '0923 812 2649'],
      address: 'Jinyang Bldg. #1, Manila Doctors Access Road, Almanza Uno, Las Piñas City',
      facebookPageName: 'Obias Nursing & Allied Courses Review Center',
    },
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

  const catalogRoles = [];
  for (const roleSeed of ROLE_CATALOG) {
    catalogRoles.push(await upsertRole(roleSeed.key, roleSeed.name, roleSeed.scope, roleSeed.permissionKeys));
  }

  // A hardcoded seed password (e.g. the previous 'ChangeMe123!') ends up
  // committed to source control — if this script is ever run against a
  // staging/production database and the password isn't rotated immediately,
  // that's a documented, guessable GLOBAL-scope super-admin credential
  // sitting in git history forever. Default to a fresh random password
  // printed once; SEED_ADMIN_PASSWORD lets local dev pin a known value for
  // repeatable logins without hardcoding one in the script itself.
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? randomBytes(12).toString('base64url');
  const passwordHash = await argon2.hash(adminPassword);

  const superAdminUser = await prisma.user.upsert({
    where: { email: 'admin@obias.local' },
    update: { passwordHash },
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
    update: { passwordHash },
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

  // One login per role in the catalog, so every permission set in the RBAC
  // model has a real account to sign in and test as — not just the two
  // accounts (super_admin, branch_manager) that predate this loop. Reuses
  // the same seeded password as those two so there's a single credential
  // to remember locally. super_admin and branch_manager already have their
  // accounts above (with names/branches worth keeping distinct), so this
  // only covers the rest of the catalog plus the student role.
  const remainingRoles = [studentRole, ...catalogRoles];

  const roleDemoUsers: { email: string; role: (typeof remainingRoles)[number] }[] = [];
  for (const role of remainingRoles) {
    const email = `${role.key}@obias.local`;
    const nameParts = role.name.split(' ');
    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash },
      create: {
        organizationId: org.id,
        email,
        passwordHash,
        firstName: nameParts[0],
        lastName: nameParts.slice(1).join(' ') || 'Demo',
        branches: { create: [{ branchId: mainBranch.id }] },
        roles: { create: [{ roleId: role.id }] },
      },
    });
    // The student login needs a StudentProfile too, or every /students/me
    // screen (settings, preferences) reports "no profile linked".
    if (role.id === studentRole.id) {
      await prisma.studentProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id, organizationId: org.id, branchId: mainBranch.id },
      });
    }
    roleDemoUsers.push({ email: user.email, role });
  }

  const admissionsOfficer = roleDemoUsers.find((u) => u.role.key === 'admissions_officer');
  const frontDeskStaff = roleDemoUsers.find((u) => u.role.key === 'front_desk_staff');

  const LEADS_SEED: {
    fullName: string;
    email?: string;
    phone?: string;
    programInterest?: string;
    source?: string;
    message?: string;
    status: 'LEAD' | 'INQUIRY' | 'APPLICATION' | 'APPLICANT' | 'ENROLLED' | 'LOST';
    branchId: string;
    assignedToEmail?: string;
  }[] = [
    {
      fullName: 'Maria Santos',
      email: 'maria.santos@example.com',
      phone: '09171234567',
      programInterest: 'Nursing Board Review',
      source: 'Facebook',
      status: 'LEAD',
      branchId: mainBranch.id,
    },
    {
      fullName: 'Juan Dela Cruz',
      email: 'juan.delacruz@example.com',
      phone: '09182345678',
      programInterest: 'Nursing Board Review',
      source: 'Walk-in',
      status: 'INQUIRY',
      branchId: mainBranch.id,
      assignedToEmail: frontDeskStaff?.email,
    },
    {
      fullName: 'Angela Reyes',
      email: 'angela.reyes@example.com',
      phone: '09193456789',
      programInterest: 'Radtech Board Review',
      source: 'Referral',
      message: 'Referred by a former reviewee, wants the weekend batch schedule.',
      status: 'APPLICATION',
      branchId: mainBranch.id,
      assignedToEmail: admissionsOfficer?.email,
    },
    {
      fullName: 'Mark Villanueva',
      email: 'mark.villanueva@example.com',
      phone: '09204567890',
      programInterest: 'Medtech Board Review',
      source: 'Instagram',
      status: 'APPLICANT',
      branchId: mainBranch.id,
      assignedToEmail: admissionsOfficer?.email,
    },
    {
      fullName: 'Kristine Bautista',
      email: 'kristine.bautista@example.com',
      phone: '09215678901',
      programInterest: 'Nursing Board Review',
      source: 'Website',
      status: 'ENROLLED',
      branchId: mainBranch.id,
      assignedToEmail: admissionsOfficer?.email,
    },
    {
      fullName: 'Paolo Mendoza',
      phone: '09226789012',
      programInterest: 'Criminology Board Review',
      source: 'TikTok',
      message: 'Asked about pricing, went silent after the second follow-up.',
      status: 'LOST',
      branchId: mainBranch.id,
      assignedToEmail: frontDeskStaff?.email,
    },
    {
      fullName: 'Hannah Cruz',
      email: 'hannah.cruz@example.com',
      phone: '09237890123',
      programInterest: 'Nursing Board Review',
      source: 'Walk-in',
      status: 'LEAD',
      branchId: secondBranch.id,
    },
    {
      fullName: 'Ramon Torres',
      email: 'ramon.torres@example.com',
      phone: '09248901234',
      programInterest: 'Radtech Board Review',
      source: 'Referral',
      status: 'INQUIRY',
      branchId: secondBranch.id,
      assignedToEmail: northManagerUser.email,
    },
  ];

  const emailToUserId = new Map(
    [superAdminUser, northManagerUser, ...(await prisma.user.findMany({ where: { organizationId: org.id } }))].map(
      (u) => [u.email, u.id],
    ),
  );

  const seededLeads = [];
  for (const leadSeed of LEADS_SEED) {
    const existing = await prisma.lead.findFirst({
      where: { organizationId: org.id, fullName: leadSeed.fullName, email: leadSeed.email ?? null },
    });
    const lead =
      existing ??
      (await prisma.lead.create({
        data: {
          organizationId: org.id,
          branchId: leadSeed.branchId,
          fullName: leadSeed.fullName,
          email: leadSeed.email,
          phone: leadSeed.phone,
          programInterest: leadSeed.programInterest,
          source: leadSeed.source,
          message: leadSeed.message,
          status: leadSeed.status,
          assignedToId: leadSeed.assignedToEmail ? emailToUserId.get(leadSeed.assignedToEmail) : undefined,
        },
      }));
    seededLeads.push(lead);
  }

  const firstOpenLead = seededLeads.find((l) => l.status !== 'ENROLLED' && l.status !== 'LOST');
  if (firstOpenLead && admissionsOfficer) {
    const hasFollowUp = await prisma.leadFollowUp.findFirst({ where: { leadId: firstOpenLead.id } });
    if (!hasFollowUp) {
      await prisma.leadFollowUp.create({
        data: {
          leadId: firstOpenLead.id,
          note: 'Called to confirm interest, sent enrollment requirements checklist.',
          createdById: emailToUserId.get(admissionsOfficer.email)!,
        },
      });
    }
  }

  const leadByName = new Map(seededLeads.map((l) => [l.fullName, l]));

  const ADMISSIONS_SEED: {
    leadName: string;
    status: 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
    notes?: string;
    reviewedByEmail?: string;
  }[] = [
    {
      leadName: 'Angela Reyes',
      status: 'UNDER_REVIEW',
      notes: 'Requirements submitted, awaiting document verification.',
      reviewedByEmail: admissionsOfficer?.email,
    },
    {
      leadName: 'Mark Villanueva',
      status: 'APPROVED',
      notes: 'All requirements verified, cleared for enrollment.',
      reviewedByEmail: admissionsOfficer?.email,
    },
    {
      leadName: 'Kristine Bautista',
      status: 'APPROVED',
      notes: 'Already enrolled; admission kept for audit trail.',
      reviewedByEmail: admissionsOfficer?.email,
    },
    {
      leadName: 'Paolo Mendoza',
      status: 'REJECTED',
      notes: 'Went unresponsive after requirements were requested twice.',
      reviewedByEmail: frontDeskStaff?.email,
    },
  ];

  let seededAdmissionsCount = 0;
  for (const admissionSeed of ADMISSIONS_SEED) {
    const lead = leadByName.get(admissionSeed.leadName);
    if (!lead) continue;

    const existing = await prisma.admission.findUnique({ where: { leadId: lead.id } });
    if (existing) continue;

    await prisma.admission.create({
      data: {
        organizationId: org.id,
        branchId: lead.branchId,
        leadId: lead.id,
        status: admissionSeed.status,
        notes: admissionSeed.notes,
        reviewedById: admissionSeed.reviewedByEmail ? emailToUserId.get(admissionSeed.reviewedByEmail) : undefined,
        reviewedAt: admissionSeed.status === 'SUBMITTED' ? undefined : new Date(),
      },
    });
    seededAdmissionsCount += 1;
  }

  // --- Curriculum: Program -> Course -> Subject -> Module -> Lesson -> Material ---
  // None of Subject/Module/Lesson/Material have a natural unique key beyond
  // their id, so each level is looked up by (parentId, name) and created
  // only if missing, keeping the whole chain idempotent on reseed.
  const nursingProgram = await prisma.program.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: 'nursing-board-review' } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Nursing Board Review',
      slug: 'nursing-board-review',
      description: 'Comprehensive review program for the Philippine Nursing Licensure Examination.',
      status: 'PUBLISHED',
    },
  });

  const nclexCourse = await prisma.course.upsert({
    where: { programId_code: { programId: nursingProgram.id, code: 'NCLEX-101' } },
    update: {},
    create: {
      programId: nursingProgram.id,
      name: 'NCLEX-Style Comprehensive Review',
      code: 'NCLEX-101',
      description: 'Core subject-area review course covering all major nursing board exam topics.',
      status: 'PUBLISHED',
    },
  });

  const CURRICULUM_SEED: {
    subject: string;
    modules: { name: string; lessons: { name: string; materials: { title: string; type: 'TEXT' | 'VIDEO' | 'PDF' }[] }[] }[];
  }[] = [
    {
      subject: 'Medical-Surgical Nursing',
      modules: [
        {
          name: 'Cardiovascular Disorders',
          lessons: [
            {
              name: 'Heart Failure',
              materials: [
                { title: 'Heart Failure Overview', type: 'TEXT' },
                { title: 'Heart Failure Lecture Video', type: 'VIDEO' },
              ],
            },
            {
              name: 'Myocardial Infarction',
              materials: [{ title: 'MI Nursing Management', type: 'PDF' }],
            },
          ],
        },
        {
          name: 'Respiratory Disorders',
          lessons: [
            {
              name: 'COPD and Asthma',
              materials: [{ title: 'COPD vs Asthma Comparison Chart', type: 'TEXT' }],
            },
          ],
        },
      ],
    },
    {
      subject: 'Maternal and Child Health Nursing',
      modules: [
        {
          name: 'Prenatal Care',
          lessons: [
            {
              name: 'Normal Pregnancy Assessment',
              materials: [{ title: 'Prenatal Visit Schedule', type: 'TEXT' }],
            },
          ],
        },
      ],
    },
    {
      subject: 'Psychiatric Nursing',
      modules: [
        {
          name: 'Mood Disorders',
          lessons: [
            {
              name: 'Major Depressive Disorder',
              materials: [{ title: 'MDD Diagnostic Criteria', type: 'TEXT' }],
            },
          ],
        },
      ],
    },
  ];

  let seededSubjects = 0;
  let seededModules = 0;
  let seededLessons = 0;
  let seededMaterials = 0;
  const subjectByName = new Map<string, Awaited<ReturnType<typeof prisma.subject.create>>>();

  for (const subjectSeed of CURRICULUM_SEED) {
    const subject =
      (await prisma.subject.findFirst({ where: { courseId: nclexCourse.id, name: subjectSeed.subject } })) ??
      (await (async () => {
        seededSubjects += 1;
        return prisma.subject.create({
          data: { courseId: nclexCourse.id, name: subjectSeed.subject, status: 'PUBLISHED' },
        });
      })());
    subjectByName.set(subjectSeed.subject, subject);

    for (const [moduleIndex, moduleSeed] of subjectSeed.modules.entries()) {
      const moduleRow =
        (await prisma.module.findFirst({ where: { subjectId: subject.id, name: moduleSeed.name } })) ??
        (await (async () => {
          seededModules += 1;
          return prisma.module.create({
            data: { subjectId: subject.id, name: moduleSeed.name, position: moduleIndex, status: 'PUBLISHED' },
          });
        })());

      for (const [lessonIndex, lessonSeed] of moduleSeed.lessons.entries()) {
        const lesson =
          (await prisma.lesson.findFirst({ where: { moduleId: moduleRow.id, name: lessonSeed.name } })) ??
          (await (async () => {
            seededLessons += 1;
            return prisma.lesson.create({
              data: { moduleId: moduleRow.id, name: lessonSeed.name, position: lessonIndex, status: 'PUBLISHED' },
            });
          })());

        for (const [materialIndex, materialSeed] of lessonSeed.materials.entries()) {
          const existingMaterial = await prisma.material.findFirst({
            where: { lessonId: lesson.id, title: materialSeed.title },
          });
          if (existingMaterial) continue;
          await prisma.material.create({
            data: {
              lessonId: lesson.id,
              title: materialSeed.title,
              type: materialSeed.type,
              position: materialIndex,
              status: 'PUBLISHED',
            },
          });
          seededMaterials += 1;
        }
      }
    }
  }

  // --- Public marketing content: Announcements, Success Stories, FAQ ---
  const contentManager = roleDemoUsers.find((u) => u.role.key === 'content_manager');

  const ANNOUNCEMENTS_SEED: { title: string; body: string; status: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED'; published?: boolean }[] = [
    {
      title: 'Enrollment for the January Nursing Board Review Batch is Now Open',
      body: 'Secure your slot for our comprehensive NCLEX-style review program. Early bird discounts available until December 15.',
      status: 'PUBLISHED',
      published: true,
    },
    {
      title: 'New North Branch Now Open',
      body: 'We are excited to announce the opening of our North Branch, offering the same programs closer to more students.',
      status: 'PUBLISHED',
      published: true,
    },
    {
      title: 'Holiday Schedule Adjustment',
      body: 'Classes will be suspended from December 24 to January 2. Regular schedules resume January 3.',
      status: 'DRAFT',
    },
  ];

  let seededAnnouncements = 0;
  for (const seed of ANNOUNCEMENTS_SEED) {
    const existing = await prisma.announcement.findFirst({ where: { organizationId: org.id, title: seed.title } });
    if (existing) continue;
    await prisma.announcement.create({
      data: {
        organizationId: org.id,
        title: seed.title,
        body: seed.body,
        status: seed.status,
        publishedAt: seed.published ? new Date() : undefined,
        authorId: contentManager ? emailToUserId.get(contentManager.email) : undefined,
      },
    });
    seededAnnouncements += 1;
  }

  const SUCCESS_STORIES_SEED: {
    graduateName: string;
    programName: string;
    year: number;
    testimonial: string;
    status: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED';
  }[] = [
    {
      graduateName: 'Ella Marie Gonzales',
      programName: 'Nursing Board Review',
      year: 2025,
      testimonial: 'The reviewers here made complex topics click. I passed on my first take, ranked in the top 10 of our batch.',
      status: 'PUBLISHED',
    },
    {
      graduateName: 'Jerome Aquino',
      programName: 'Radtech Board Review',
      year: 2025,
      testimonial: 'The mock exams were harder than the actual board exam, which made the real thing feel manageable.',
      status: 'PUBLISHED',
    },
    {
      graduateName: 'Cherry Anne Domingo',
      programName: 'Medtech Board Review',
      year: 2024,
      testimonial: 'Small class sizes meant I could ask questions freely. Grateful for the personalized attention.',
      status: 'REVIEW',
    },
  ];

  let seededSuccessStories = 0;
  for (const seed of SUCCESS_STORIES_SEED) {
    const existing = await prisma.successStory.findFirst({
      where: { organizationId: org.id, graduateName: seed.graduateName },
    });
    if (existing) continue;
    await prisma.successStory.create({
      data: {
        organizationId: org.id,
        graduateName: seed.graduateName,
        programName: seed.programName,
        year: seed.year,
        testimonial: seed.testimonial,
        status: seed.status,
      },
    });
    seededSuccessStories += 1;
  }

  const FAQ_SEED: { question: string; answer: string; status: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED' }[] = [
    {
      question: 'What are the requirements to enroll in a review program?',
      answer: 'A copy of your transcript of records, a valid ID, and a completed application form. Our admissions team will guide you through document submission.',
      status: 'PUBLISHED',
    },
    {
      question: 'Do you offer payment plans?',
      answer: 'Yes, we offer installment plans for most programs. Ask our Finance office for the current schedule of terms.',
      status: 'PUBLISHED',
    },
    {
      question: 'Are classes available online or only in person?',
      answer: 'We currently offer in-person classes at our Main and North branches, with select subjects available via recorded lessons.',
      status: 'PUBLISHED',
    },
    {
      question: 'What happens if I miss a scheduled exam?',
      answer: 'Contact your assigned instructor or the registrar as soon as possible to arrange a makeup schedule, subject to approval.',
      status: 'DRAFT',
    },
  ];

  let seededFaqItems = 0;
  for (const [index, seed] of FAQ_SEED.entries()) {
    const existing = await prisma.faqItem.findFirst({ where: { organizationId: org.id, question: seed.question } });
    if (existing) continue;
    await prisma.faqItem.create({
      data: {
        organizationId: org.id,
        question: seed.question,
        answer: seed.answer,
        position: index,
        status: seed.status,
      },
    });
    seededFaqItems += 1;
  }

  // --- Rooms, Batches, Classes ---
  const ROOMS_SEED: { name: string; capacity: number; branch: typeof mainBranch }[] = [
    { name: 'Room 101', capacity: 40, branch: mainBranch },
    { name: 'Room 102', capacity: 30, branch: mainBranch },
    { name: 'Online Room', capacity: 100, branch: mainBranch },
    { name: 'Room 201', capacity: 35, branch: secondBranch },
  ];

  const roomByKey = new Map<string, Awaited<ReturnType<typeof prisma.room.upsert>>>();
  for (const seed of ROOMS_SEED) {
    const room = await prisma.room.upsert({
      where: { branchId_name: { branchId: seed.branch.id, name: seed.name } },
      update: {},
      create: { branchId: seed.branch.id, name: seed.name, capacity: seed.capacity },
    });
    roomByKey.set(`${seed.branch.id}:${seed.name}`, room);
  }
  const seededRooms = ROOMS_SEED.length;

  const mainBatch =
    (await prisma.batch.findFirst({ where: { programId: nursingProgram.id, branchId: mainBranch.id, name: 'January 2026 Batch' } })) ??
    (await prisma.batch.create({
      data: {
        programId: nursingProgram.id,
        branchId: mainBranch.id,
        name: 'January 2026 Batch',
        startDate: new Date('2026-01-05'),
        endDate: new Date('2026-04-30'),
        status: 'UPCOMING',
      },
    }));

  const northBatch =
    (await prisma.batch.findFirst({ where: { programId: nursingProgram.id, branchId: secondBranch.id, name: 'February 2026 Batch' } })) ??
    (await prisma.batch.create({
      data: {
        programId: nursingProgram.id,
        branchId: secondBranch.id,
        name: 'February 2026 Batch',
        startDate: new Date('2026-02-02'),
        endDate: new Date('2026-05-29'),
        status: 'UPCOMING',
      },
    }));

  // Give the "lead_instructor" and "instructor" demo accounts a real
  // InstructorProfile so seeded classes have someone real to assign to,
  // instead of every class showing "Unassigned".
  const leadInstructorDemo = roleDemoUsers.find((u) => u.role.key === 'lead_instructor');
  const instructorDemo = roleDemoUsers.find((u) => u.role.key === 'instructor');

  async function upsertInstructorProfile(email: string | undefined, branchId: string, specialization: string) {
    if (!email) return null;
    const userId = emailToUserId.get(email);
    if (!userId) return null;
    // Demo instructors are listed on the public site so /instructors has
    // something to show; real profiles start private (isPublic defaults false).
    return prisma.instructorProfile.upsert({
      where: { userId },
      update: { isPublic: true },
      create: { userId, organizationId: org.id, branchId, specialization, isPublic: true },
    });
  }

  const leadInstructorProfile = await upsertInstructorProfile(
    leadInstructorDemo?.email,
    mainBranch.id,
    'Medical-Surgical Nursing',
  );
  const instructorProfile = await upsertInstructorProfile(instructorDemo?.email, mainBranch.id, 'Maternal and Child Health Nursing');

  const CLASSES_SEED: {
    name: string;
    batch: typeof mainBatch;
    roomKey: string;
    status: 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
    instructorProfileId?: string | null;
  }[] = [
    {
      name: 'NCLEX Review - Section A',
      batch: mainBatch,
      roomKey: `${mainBranch.id}:Room 101`,
      status: 'SCHEDULED',
      instructorProfileId: leadInstructorProfile?.id,
    },
    {
      name: 'NCLEX Review - Section B',
      batch: mainBatch,
      roomKey: `${mainBranch.id}:Room 102`,
      status: 'SCHEDULED',
      instructorProfileId: instructorProfile?.id,
    },
    {
      name: 'NCLEX Review - Online Cohort',
      batch: mainBatch,
      roomKey: `${mainBranch.id}:Online Room`,
      status: 'ACTIVE',
      instructorProfileId: leadInstructorProfile?.id,
    },
    {
      name: 'NCLEX Review - North Branch',
      batch: northBatch,
      roomKey: `${secondBranch.id}:Room 201`,
      status: 'SCHEDULED',
    },
  ];

  let seededClasses = 0;
  const classByName = new Map<string, Awaited<ReturnType<typeof prisma.class.create>>>();
  for (const seed of CLASSES_SEED) {
    const existing = await prisma.class.findFirst({ where: { batchId: seed.batch.id, name: seed.name } });
    if (existing) {
      classByName.set(seed.name, existing);
      continue;
    }
    const room = roomByKey.get(seed.roomKey);
    const created = await prisma.class.create({
      data: {
        batchId: seed.batch.id,
        courseId: nclexCourse.id,
        branchId: seed.batch.branchId,
        roomId: room?.id,
        instructorProfileId: seed.instructorProfileId ?? undefined,
        name: seed.name,
        status: seed.status,
      },
    });
    classByName.set(seed.name, created);
    seededClasses += 1;
  }

  // --- Schedules: weekly meeting times per seeded class ---
  const SCHEDULES_SEED: { className: string; dayOfWeek: number; startTime: string; endTime: string }[] = [
    { className: 'NCLEX Review - Section A', dayOfWeek: 1, startTime: '08:00', endTime: '11:00' },
    { className: 'NCLEX Review - Section A', dayOfWeek: 3, startTime: '08:00', endTime: '11:00' },
    { className: 'NCLEX Review - Section B', dayOfWeek: 2, startTime: '13:00', endTime: '16:00' },
    { className: 'NCLEX Review - Section B', dayOfWeek: 4, startTime: '13:00', endTime: '16:00' },
    { className: 'NCLEX Review - Online Cohort', dayOfWeek: 6, startTime: '09:00', endTime: '12:00' },
    { className: 'NCLEX Review - North Branch', dayOfWeek: 1, startTime: '09:00', endTime: '12:00' },
    { className: 'NCLEX Review - North Branch', dayOfWeek: 5, startTime: '09:00', endTime: '12:00' },
  ];

  let seededSchedules = 0;
  for (const seed of SCHEDULES_SEED) {
    const classRow = classByName.get(seed.className);
    if (!classRow) continue;
    const existing = await prisma.schedule.findFirst({
      where: { classId: classRow.id, dayOfWeek: seed.dayOfWeek, startTime: seed.startTime },
    });
    if (existing) continue;
    await prisma.schedule.create({
      data: {
        classId: classRow.id,
        dayOfWeek: seed.dayOfWeek,
        startTime: seed.startTime,
        endTime: seed.endTime,
      },
    });
    seededSchedules += 1;
  }

  // --- Staff profiles for a subset of the per-role demo accounts ---
  const STAFF_SEED: {
    roleKey: string;
    position: string;
    department: string;
    branch: typeof mainBranch;
    hireDate: string;
  }[] = [
    { roleKey: 'hr_manager', position: 'HR Manager', department: 'Human Resources', branch: mainBranch, hireDate: '2022-03-01' },
    { roleKey: 'hr_staff', position: 'HR Assistant', department: 'Human Resources', branch: mainBranch, hireDate: '2023-06-15' },
    { roleKey: 'front_desk_staff', position: 'Front Desk Officer', department: 'Admissions', branch: mainBranch, hireDate: '2023-01-10' },
    { roleKey: 'general_staff', position: 'Facilities Assistant', department: 'Operations', branch: mainBranch, hireDate: '2024-02-20' },
    { roleKey: 'cashier', position: 'Cashier', department: 'Finance', branch: mainBranch, hireDate: '2023-09-05' },
    { roleKey: 'finance_officer', position: 'Finance Officer', department: 'Finance', branch: mainBranch, hireDate: '2022-11-01' },
    { roleKey: 'registrar', position: 'Registrar', department: 'Academic Affairs', branch: secondBranch, hireDate: '2023-04-18' },
  ];

  let seededStaff = 0;
  for (const seed of STAFF_SEED) {
    const demoUser = roleDemoUsers.find((u) => u.role.key === seed.roleKey);
    if (!demoUser) continue;
    const userId = emailToUserId.get(demoUser.email);
    if (!userId) continue;

    const existing = await prisma.staffProfile.findUnique({ where: { userId } });
    if (existing) continue;

    await prisma.staffProfile.create({
      data: {
        userId,
        organizationId: org.id,
        branchId: seed.branch.id,
        position: seed.position,
        department: seed.department,
        hireDate: new Date(seed.hireDate),
        status: 'ACTIVE',
      },
    });
    seededStaff += 1;
  }

  // --- Sample students + attendance for the seeded classes ---
  const STUDENTS_SEED = [
    { firstName: 'Liza', lastName: 'Fernandez', email: 'liza.fernandez@example.com' },
    { firstName: 'Miguel', lastName: 'Ramos', email: 'miguel.ramos@example.com' },
    { firstName: 'Trisha', lastName: 'Navarro', email: 'trisha.navarro@example.com' },
  ];

  const studentPasswordHash = await argon2.hash(adminPassword);
  const studentProfiles = [];
  for (const seed of STUDENTS_SEED) {
    const user = await prisma.user.upsert({
      where: { email: seed.email },
      update: { passwordHash: studentPasswordHash },
      create: {
        organizationId: org.id,
        email: seed.email,
        passwordHash: studentPasswordHash,
        firstName: seed.firstName,
        lastName: seed.lastName,
        branches: { create: [{ branchId: mainBranch.id }] },
        roles: { create: [{ roleId: studentRole.id }] },
      },
    });

    const profile = await prisma.studentProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, organizationId: org.id, branchId: mainBranch.id },
    });
    studentProfiles.push({ ...profile, email: user.email, firstName: user.firstName, lastName: user.lastName });
  }

  // A class roster is "students ENROLLED in the class's batch" (see
  // ClassesService.roster), so without these the attendance seeded below
  // belongs to students no class ever lists.
  let seededEnrollments = 0;
  for (const student of studentProfiles) {
    const existing = await prisma.enrollment.findFirst({ where: { studentId: student.id, batchId: mainBatch.id } });
    if (existing) continue;
    await prisma.enrollment.create({
      data: {
        studentId: student.id,
        programId: nursingProgram.id,
        batchId: mainBatch.id,
        branchId: mainBranch.id,
        status: 'ENROLLED',
      },
    });
    seededEnrollments += 1;
  }

  const attendanceMarker = leadInstructorDemo ? emailToUserId.get(leadInstructorDemo.email) : undefined;
  const sectionAClass = classByName.get('NCLEX Review - Section A');
  const attendanceDates = ['2026-01-06', '2026-01-08', '2026-01-13'];
  const ATTENDANCE_STATUS_CYCLE: ('PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED')[] = ['PRESENT', 'PRESENT', 'LATE'];

  let seededAttendance = 0;
  if (sectionAClass) {
    for (const [dateIndex, date] of attendanceDates.entries()) {
      for (const [studentIndex, student] of studentProfiles.entries()) {
        const status = dateIndex === 2 && studentIndex === 2 ? 'ABSENT' : ATTENDANCE_STATUS_CYCLE[studentIndex];
        const existing = await prisma.attendance.findUnique({
          where: {
            studentId_classId_date: { studentId: student.id, classId: sectionAClass.id, date: new Date(date) },
          },
        });
        if (existing) continue;
        await prisma.attendance.create({
          data: {
            studentId: student.id,
            classId: sectionAClass.id,
            date: new Date(date),
            status,
            markedById: attendanceMarker,
          },
        });
        seededAttendance += 1;
      }
    }
  }

  // --- Question bank ---
  const examAdministratorDemo = roleDemoUsers.find((u) => u.role.key === 'exam_administrator');
  const questionAuthorId = examAdministratorDemo
    ? emailToUserId.get(examAdministratorDemo.email)
    : superAdminUser.id;

  const QUESTIONS_SEED: {
    subjectName: string;
    type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'IDENTIFICATION' | 'ESSAY';
    difficulty: 'EASY' | 'MODERATE' | 'DIFFICULT';
    topic: string;
    content: string;
    options?: { id: string; text: string }[];
    correctAnswer: unknown;
    explanation?: string;
  }[] = [
    {
      subjectName: 'Medical-Surgical Nursing',
      type: 'MULTIPLE_CHOICE',
      difficulty: 'MODERATE',
      topic: 'Cardiovascular Disorders',
      content: 'Which of the following is the earliest and most common symptom of left-sided heart failure?',
      options: [
        { id: 'a', text: 'Dyspnea on exertion' },
        { id: 'b', text: 'Peripheral edema' },
        { id: 'c', text: 'Jugular vein distension' },
        { id: 'd', text: 'Ascites' },
      ],
      correctAnswer: 'a',
      explanation: 'Left-sided heart failure causes pulmonary congestion, making dyspnea on exertion the earliest sign, while edema/JVD/ascites are right-sided signs.',
    },
    {
      subjectName: 'Medical-Surgical Nursing',
      type: 'TRUE_FALSE',
      difficulty: 'EASY',
      topic: 'Respiratory Disorders',
      content: 'Pursed-lip breathing is taught to COPD patients to help prevent early airway collapse.',
      correctAnswer: true,
    },
    {
      subjectName: 'Maternal and Child Health Nursing',
      type: 'MULTIPLE_CHOICE',
      difficulty: 'MODERATE',
      topic: 'Prenatal Care',
      content: 'At what gestational age is the first prenatal visit typically recommended?',
      options: [
        { id: 'a', text: 'As soon as pregnancy is confirmed' },
        { id: 'b', text: 'At 20 weeks' },
        { id: 'c', text: 'At 28 weeks' },
        { id: 'd', text: 'Only in the third trimester' },
      ],
      correctAnswer: 'a',
      explanation: 'Early prenatal care allows for baseline assessment and early identification of risk factors.',
    },
    {
      subjectName: 'Psychiatric Nursing',
      type: 'IDENTIFICATION',
      difficulty: 'DIFFICULT',
      topic: 'Mood Disorders',
      content: 'What is the minimum duration of depressive symptoms required for a diagnosis of Major Depressive Disorder per the DSM-5?',
      correctAnswer: '2 weeks',
    },
    {
      subjectName: 'Medical-Surgical Nursing',
      type: 'MULTIPLE_CHOICE',
      difficulty: 'MODERATE',
      topic: 'Endocrine Disorders',
      content: 'A client with type 1 diabetes is shaky, diaphoretic, and anxious before lunch. What should the nurse do first?',
      options: [
        { id: 'a', text: 'Check the capillary blood glucose' },
        { id: 'b', text: 'Administer the scheduled insulin dose' },
        { id: 'c', text: 'Notify the physician' },
        { id: 'd', text: 'Encourage the client to rest' },
      ],
      correctAnswer: 'a',
      explanation: 'These are signs of hypoglycemia; confirming the glucose level guides immediate treatment with fast-acting carbohydrates.',
    },
    {
      subjectName: 'Medical-Surgical Nursing',
      type: 'TRUE_FALSE',
      difficulty: 'EASY',
      topic: 'Fluids and Electrolytes',
      content: 'Potassium chloride may be safely administered by IV push.',
      correctAnswer: false,
      explanation: 'IV push potassium can cause fatal cardiac arrhythmias; it must always be diluted and infused.',
    },
    {
      subjectName: 'Maternal and Child Health Nursing',
      type: 'MULTIPLE_CHOICE',
      difficulty: 'EASY',
      topic: 'Newborn Assessment',
      content: 'The APGAR score is routinely assessed at which times after birth?',
      options: [
        { id: 'a', text: '1 and 5 minutes' },
        { id: 'b', text: '5 and 10 minutes' },
        { id: 'c', text: 'Immediately and at 1 hour' },
        { id: 'd', text: '30 seconds and 2 minutes' },
      ],
      correctAnswer: 'a',
    },
    {
      subjectName: 'Psychiatric Nursing',
      type: 'MULTIPLE_CHOICE',
      difficulty: 'MODERATE',
      topic: 'Crisis Intervention',
      content: 'A client states, "I have a plan to end my life tonight." What is the nurse\'s priority action?',
      options: [
        { id: 'a', text: 'Ensure the client\'s immediate safety with constant observation' },
        { id: 'b', text: 'Schedule a follow-up session for tomorrow' },
        { id: 'c', text: 'Explore the client\'s childhood experiences' },
        { id: 'd', text: 'Reassure the client that things will get better' },
      ],
      correctAnswer: 'a',
      explanation: 'A client with a specific plan is at high risk; safety takes priority over all other interventions.',
    },
    {
      subjectName: 'Medical-Surgical Nursing',
      type: 'ESSAY',
      difficulty: 'DIFFICULT',
      topic: 'Post-operative Care',
      content: 'Describe the priority nursing assessments and interventions for a client during the first 24 hours after a thyroidectomy.',
      correctAnswer: 'Airway patency and respiratory distress; hemorrhage at the incision (check behind the neck); signs of hypocalcemia (tingling, Chvostek/Trousseau); voice changes from laryngeal nerve injury; semi-Fowler\'s position with neck support; tracheostomy set at bedside.',
    },
  ];

  let seededQuestions = 0;
  for (const seed of QUESTIONS_SEED) {
    const subject = subjectByName.get(seed.subjectName);
    if (!subject || !questionAuthorId) continue;
    const existing = await prisma.question.findFirst({ where: { subjectId: subject.id, content: seed.content } });
    if (existing) continue;
    await prisma.question.create({
      data: {
        subjectId: subject.id,
        authorId: questionAuthorId,
        type: seed.type,
        difficulty: seed.difficulty,
        topic: seed.topic,
        content: seed.content,
        options: seed.options,
        correctAnswer: seed.correctAnswer as never,
        explanation: seed.explanation,
        status: 'PUBLISHED',
      },
    });
    seededQuestions += 1;
  }

  // --- Program pricing ---
  const PRICING_SEED: { program: typeof nursingProgram; amount: number; currency: string }[] = [
    { program: nursingProgram, amount: 15000_00, currency: 'PHP' },
  ];

  let seededPricing = 0;
  for (const seed of PRICING_SEED) {
    const existing = await prisma.pricing.findFirst({
      where: { programId: seed.program.id, amount: seed.amount, currency: seed.currency, isActive: true },
    });
    if (existing) continue;
    await prisma.pricing.create({
      data: { programId: seed.program.id, amount: seed.amount, currency: seed.currency, isActive: true },
    });
    seededPricing += 1;
  }

  // --- Demo walkthrough data (see docs/DEMO_PLAN.md) ---
  // Without this, every exam, finance, grading, certificate and
  // notification screen in the demo script opens empty. The student@ login
  // is a graduate of the January batch: COMPLETED still grants program
  // access (PROGRAM_ACCESS_ENROLLMENT_STATUSES) and is what certificate
  // issuance requires. The batch's other students give finance and the
  // instructor's grading queue something to act on live.
  const orgSettings = await prisma.organizationSettings.findUnique({ where: { organizationId: org.id } });
  const receiptPrefix = orgSettings?.receiptPrefix ?? 'RCPT';
  const certificatePrefix = orgSettings?.certificatePrefix ?? 'CERT';
  const cashierUserId = emailToUserId.get('cashier@obias.local') ?? superAdminUser.id;
  const financeOfficerUserId = emailToUserId.get('finance_officer@obias.local') ?? superAdminUser.id;
  const registrarUserId = emailToUserId.get('registrar@obias.local') ?? superAdminUser.id;

  const demoStudentUserId = emailToUserId.get('student@obias.local');
  const demoStudentProfile = demoStudentUserId
    ? await prisma.studentProfile.findUnique({ where: { userId: demoStudentUserId } })
    : null;

  if (demoStudentProfile) {
    const existing = await prisma.enrollment.findFirst({
      where: { studentId: demoStudentProfile.id, batchId: mainBatch.id },
    });
    if (!existing) {
      await prisma.enrollment.create({
        data: {
          studentId: demoStudentProfile.id,
          programId: nursingProgram.id,
          batchId: mainBatch.id,
          branchId: mainBranch.id,
          status: 'COMPLETED',
        },
      });
      seededEnrollments += 1;
    }
  }

  // North Branch students, so the branch manager's branch-scoped dashboard
  // has something to show next to the org-wide owner view.
  const NORTH_STUDENTS_SEED = [
    { firstName: 'Angela', lastName: 'Cruz', email: 'angela.cruz@example.com' },
    { firstName: 'Paolo', lastName: 'Villanueva', email: 'paolo.villanueva@example.com' },
  ];
  for (const seed of NORTH_STUDENTS_SEED) {
    const user = await prisma.user.upsert({
      where: { email: seed.email },
      update: { passwordHash: studentPasswordHash },
      create: {
        organizationId: org.id,
        email: seed.email,
        passwordHash: studentPasswordHash,
        firstName: seed.firstName,
        lastName: seed.lastName,
        branches: { create: [{ branchId: secondBranch.id }] },
        roles: { create: [{ roleId: studentRole.id }] },
      },
    });
    const profile = await prisma.studentProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, organizationId: org.id, branchId: secondBranch.id },
    });
    const existing = await prisma.enrollment.findFirst({ where: { studentId: profile.id, batchId: northBatch.id } });
    if (existing) continue;
    await prisma.enrollment.create({
      data: {
        studentId: profile.id,
        programId: nursingProgram.id,
        batchId: northBatch.id,
        branchId: secondBranch.id,
        status: 'ENROLLED',
      },
    });
    seededEnrollments += 1;
  }

  // Attendance for the demo student (Section A, alongside the batch) and a
  // history for Section B, the instructor@ login's own class, so neither
  // attendance screen opens empty before the live roll call.
  const instructorUserId = instructorDemo ? emailToUserId.get(instructorDemo.email) : undefined;
  const sectionBClass = classByName.get('NCLEX Review - Section B');
  const ATTENDANCE_EXTRA: { classRow: typeof sectionAClass; students: { id: string }[]; markedById?: string }[] = [
    { classRow: sectionAClass, students: demoStudentProfile ? [demoStudentProfile] : [], markedById: attendanceMarker },
    {
      classRow: sectionBClass,
      students: [...studentProfiles, ...(demoStudentProfile ? [demoStudentProfile] : [])],
      markedById: instructorUserId,
    },
  ];
  for (const { classRow, students, markedById } of ATTENDANCE_EXTRA) {
    if (!classRow) continue;
    for (const [dateIndex, date] of attendanceDates.entries()) {
      for (const [studentIndex, student] of students.entries()) {
        const where = { studentId_classId_date: { studentId: student.id, classId: classRow.id, date: new Date(date) } };
        if (await prisma.attendance.findUnique({ where })) continue;
        await prisma.attendance.create({
          data: {
            studentId: student.id,
            classId: classRow.id,
            date: new Date(date),
            status: dateIndex === 1 && studentIndex === 1 ? 'LATE' : 'PRESENT',
            markedById,
          },
        });
        seededAttendance += 1;
      }
    }
  }

  const lizaProfile = studentProfiles.find((s) => s.email === 'liza.fernandez@example.com');
  const miguelProfile = studentProfiles.find((s) => s.email === 'miguel.ramos@example.com');
  const trishaProfile = studentProfiles.find((s) => s.email === 'trisha.navarro@example.com');

  // Exams reference questions by their content, so they stay readable here
  // and survive re-seeding (question ids are uuids).
  const Q = {
    heartFailure: QUESTIONS_SEED[0].content,
    pursedLip: QUESTIONS_SEED[1].content,
    prenatal: QUESTIONS_SEED[2].content,
    mdd: QUESTIONS_SEED[3].content,
    hypoglycemia: QUESTIONS_SEED[4].content,
    potassium: QUESTIONS_SEED[5].content,
    apgar: QUESTIONS_SEED[6].content,
    suicide: QUESTIONS_SEED[7].content,
    thyroidectomy: QUESTIONS_SEED[8].content,
  };
  const questionRows = await prisma.question.findMany({
    where: { content: { in: Object.values(Q) }, subject: { course: { programId: nursingProgram.id } } },
  });
  const questionByContent = new Map(questionRows.map((q) => [q.content, q]));

  const EXAMS_SEED: {
    title: string;
    type: 'PRACTICE' | 'DIAGNOSTIC' | 'MOCK' | 'FINAL';
    timeLimitMinutes: number;
    passingScore: number;
    attemptLimit: number;
    questions: { content: string; points: number }[];
  }[] = [
    {
      title: 'NCLEX Diagnostic Exam',
      type: 'DIAGNOSTIC',
      timeLimitMinutes: 30,
      passingScore: 4,
      attemptLimit: 1,
      questions: [Q.heartFailure, Q.pursedLip, Q.prenatal, Q.mdd, Q.apgar, Q.suicide].map((content) => ({ content, points: 1 })),
    },
    {
      // Left with spare attempts so the student@ login can take it live.
      title: 'Med-Surg Practice Quiz',
      type: 'PRACTICE',
      timeLimitMinutes: 10,
      passingScore: 3,
      attemptLimit: 10,
      questions: [Q.heartFailure, Q.pursedLip, Q.hypoglycemia, Q.potassium].map((content) => ({ content, points: 1 })),
    },
    {
      title: 'NCLEX Mock Exam 1',
      type: 'MOCK',
      timeLimitMinutes: 60,
      passingScore: 7,
      attemptLimit: 1,
      questions: [
        ...[Q.heartFailure, Q.hypoglycemia, Q.potassium, Q.apgar, Q.suicide].map((content) => ({ content, points: 1 })),
        { content: Q.thyroidectomy, points: 5 },
      ],
    },
  ];

  let seededExams = 0;
  const examByTitle = new Map<string, Awaited<ReturnType<typeof prisma.exam.create>>>();
  for (const seed of EXAMS_SEED) {
    let exam = await prisma.exam.findFirst({ where: { organizationId: org.id, title: seed.title } });
    if (!exam) {
      exam = await prisma.exam.create({
        data: {
          organizationId: org.id,
          programId: nursingProgram.id,
          title: seed.title,
          type: seed.type,
          timeLimitMinutes: seed.timeLimitMinutes,
          passingScore: seed.passingScore,
          attemptLimit: seed.attemptLimit,
          status: 'PUBLISHED',
          questions: {
            create: seed.questions.flatMap(({ content, points }, position) => {
              const question = questionByContent.get(content);
              return question ? [{ questionId: question.id, points, position }] : [];
            }),
          },
        },
      });
      seededExams += 1;
    }
    examByTitle.set(seed.title, exam);
  }

  // Items still waiting on staff (ungraded essays, the unverified payment)
  // are dated relative to seeding time so the demo shows them as a couple
  // of days old, not as months of neglect.
  const daysAgo = (days: number, hour = 10) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };

  // Responses are what the student "picked"; correctness and scores are
  // derived the same way AttemptsService.submit grades them, so the
  // seeded history matches what the real exam engine would have produced.
  // `essayPoints` set = already hand-graded; omitted = still in the
  // instructor's grading queue (status SUBMITTED).
  const ATTEMPTS_SEED: {
    student: { id: string } | null | undefined;
    examTitle: string;
    startedAt: string;
    minutes: number;
    responses: Record<string, unknown>;
    essayPoints?: number;
    // Dated relative to seeding time, so it can't be matched by startedAt
    // on a re-run; matched by exam + student instead.
    relative?: boolean;
  }[] = [
    // student@ — a full graduate's history for /student/progress
    {
      student: demoStudentProfile,
      examTitle: 'NCLEX Diagnostic Exam',
      startedAt: '2026-01-09T09:00:00+08:00',
      minutes: 24,
      responses: { [Q.heartFailure]: 'b', [Q.pursedLip]: true, [Q.prenatal]: 'a', [Q.mdd]: '1 month', [Q.apgar]: 'a', [Q.suicide]: 'a' },
    },
    {
      student: demoStudentProfile,
      examTitle: 'Med-Surg Practice Quiz',
      startedAt: '2026-02-03T19:30:00+08:00',
      minutes: 8,
      responses: { [Q.heartFailure]: 'b', [Q.pursedLip]: true, [Q.hypoglycemia]: 'c', [Q.potassium]: false },
    },
    {
      student: demoStudentProfile,
      examTitle: 'Med-Surg Practice Quiz',
      startedAt: '2026-03-02T20:00:00+08:00',
      minutes: 6,
      responses: { [Q.heartFailure]: 'a', [Q.pursedLip]: true, [Q.hypoglycemia]: 'c', [Q.potassium]: false },
    },
    {
      student: demoStudentProfile,
      examTitle: 'NCLEX Mock Exam 1',
      startedAt: '2026-04-11T09:00:00+08:00',
      minutes: 52,
      responses: {
        [Q.heartFailure]: 'a',
        [Q.hypoglycemia]: 'a',
        [Q.potassium]: false,
        [Q.apgar]: 'b',
        [Q.suicide]: 'a',
        [Q.thyroidectomy]:
          'Monitor airway and breathing closely and keep a tracheostomy set at the bedside. Check the dressing and the back of the neck for bleeding. Watch for tingling or muscle spasms (hypocalcemia) and assess voice quality. Position in semi-Fowler\'s with the head and neck supported.',
      },
      essayPoints: 4,
    },
    // Rest of the January batch — results spread + live grading queue
    {
      student: lizaProfile,
      examTitle: 'NCLEX Diagnostic Exam',
      startedAt: '2026-01-09T09:00:00+08:00',
      minutes: 27,
      responses: { [Q.heartFailure]: 'a', [Q.pursedLip]: true, [Q.prenatal]: 'a', [Q.mdd]: '2 weeks', [Q.apgar]: 'b', [Q.suicide]: 'a' },
    },
    {
      student: miguelProfile,
      examTitle: 'NCLEX Diagnostic Exam',
      startedAt: '2026-01-09T09:00:00+08:00',
      minutes: 30,
      responses: { [Q.heartFailure]: 'c', [Q.pursedLip]: false, [Q.prenatal]: 'a', [Q.mdd]: '6 months', [Q.apgar]: 'a', [Q.suicide]: 'd' },
    },
    {
      student: trishaProfile,
      examTitle: 'NCLEX Diagnostic Exam',
      startedAt: '2026-01-09T09:00:00+08:00',
      minutes: 22,
      responses: { [Q.heartFailure]: 'a', [Q.pursedLip]: true, [Q.prenatal]: 'b', [Q.mdd]: '2 weeks', [Q.apgar]: 'a', [Q.suicide]: 'b' },
    },
    {
      student: lizaProfile,
      examTitle: 'NCLEX Mock Exam 1',
      startedAt: daysAgo(2, 9),
      relative: true,
      minutes: 55,
      responses: {
        [Q.heartFailure]: 'a',
        [Q.hypoglycemia]: 'a',
        [Q.potassium]: false,
        [Q.apgar]: 'a',
        [Q.suicide]: 'a',
        [Q.thyroidectomy]:
          'Priority is the airway because swelling or bleeding can block it. I would check vital signs, look for bleeding at the incision, and ask the patient to speak to check the laryngeal nerve. Monitor calcium and watch for tetany.',
      },
    },
    {
      student: miguelProfile,
      examTitle: 'NCLEX Mock Exam 1',
      startedAt: daysAgo(1, 13),
      relative: true,
      minutes: 60,
      responses: {
        [Q.heartFailure]: 'b',
        [Q.hypoglycemia]: 'a',
        [Q.potassium]: true,
        [Q.apgar]: 'a',
        [Q.suicide]: 'a',
        [Q.thyroidectomy]: 'Check vital signs and give pain medication. Keep the patient comfortable and monitor the wound.',
      },
    },
  ];

  let seededAttempts = 0;
  for (const seed of ATTEMPTS_SEED) {
    const exam = examByTitle.get(seed.examTitle);
    if (!seed.student || !exam) continue;
    const startedAt = new Date(seed.startedAt);
    const existing = await prisma.attempt.findFirst({
      where: { examId: exam.id, studentId: seed.student.id, ...(seed.relative ? {} : { startedAt }) },
    });
    if (existing) continue;

    const examQuestions = await prisma.examQuestion.findMany({ where: { examId: exam.id }, include: { question: true } });
    const answers = examQuestions.map(({ question, points }) => {
      const response = seed.responses[question.content];
      if (question.type === 'ESSAY') {
        const graded = seed.essayPoints !== undefined;
        return {
          questionId: question.id,
          response: response as never,
          needsManualGrading: !graded,
          isCorrect: graded ? seed.essayPoints! > 0 : null,
          pointsAwarded: graded ? seed.essayPoints! : null,
        };
      }
      const correct = question.correctAnswer;
      const isCorrect =
        typeof correct === 'string' && typeof response === 'string'
          ? correct.trim().toLowerCase() === response.trim().toLowerCase()
          : Boolean(correct) === Boolean(response);
      return { questionId: question.id, response: response as never, needsManualGrading: false, isCorrect, pointsAwarded: isCorrect ? points : 0 };
    });

    const maxScore = examQuestions.reduce((sum, eq) => sum + eq.points, 0);
    const submittedAt = new Date(startedAt.getTime() + seed.minutes * 60_000);
    const pending = answers.some((a) => a.needsManualGrading);
    const score = answers.reduce((sum, a) => sum + (a.pointsAwarded ?? 0), 0);
    const hasEssay = examQuestions.some((eq) => eq.question.type === 'ESSAY');

    await prisma.attempt.create({
      data: {
        examId: exam.id,
        studentId: seed.student.id,
        startedAt,
        submittedAt,
        maxScore,
        ...(pending
          ? { status: 'SUBMITTED' }
          : {
              status: 'GRADED',
              score,
              passed: score >= exam.passingScore,
              // Hand-graded attempts finish a couple of days after submission.
              gradedAt: hasEssay ? new Date(submittedAt.getTime() + 2 * 86_400_000) : submittedAt,
            }),
        answers: { create: answers },
      },
    });
    seededAttempts += 1;
  }

  // Invoices for the January batch: one of each status so /finance has a
  // paid, a partially paid (with a PENDING payment for Finance Officer to
  // verify live — Cashier can record but not verify), and an overdue one.
  const INVOICES_SEED: {
    student: { id: string } | null | undefined;
    discountAmount: number;
    status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
    dueDate: string;
    payments: { amount: number; method: 'CASH' | 'BANK_TRANSFER' | 'GCASH'; date: string; verified: boolean }[];
  }[] = [
    {
      student: demoStudentProfile,
      discountAmount: 1500_00,
      status: 'PAID',
      dueDate: '2026-01-05',
      payments: [
        { amount: 6750_00, method: 'GCASH', date: '2025-12-18', verified: true },
        { amount: 6750_00, method: 'BANK_TRANSFER', date: '2026-02-14', verified: true },
      ],
    },
    {
      student: lizaProfile,
      discountAmount: 0,
      status: 'PAID',
      dueDate: '2026-01-05',
      payments: [{ amount: 15000_00, method: 'CASH', date: '2025-12-29', verified: true }],
    },
    {
      student: miguelProfile,
      discountAmount: 0,
      status: 'PARTIALLY_PAID',
      dueDate: '2026-01-05',
      payments: [
        { amount: 7500_00, method: 'GCASH', date: '2026-01-03', verified: true },
        { amount: 7500_00, method: 'BANK_TRANSFER', date: daysAgo(2), verified: false },
      ],
    },
    { student: trishaProfile, discountAmount: 0, status: 'UNPAID', dueDate: '2026-01-05', payments: [] },
  ];

  let seededInvoices = 0;
  for (const seed of INVOICES_SEED) {
    if (!seed.student) continue;
    const enrollment = await prisma.enrollment.findFirst({ where: { studentId: seed.student.id, batchId: mainBatch.id } });
    if (!enrollment) continue;
    const existing = await prisma.invoice.findFirst({ where: { enrollmentId: enrollment.id } });
    if (existing) continue;

    const amount = 15000_00;
    const invoice = await prisma.invoice.create({
      data: {
        enrollmentId: enrollment.id,
        organizationId: org.id,
        branchId: mainBranch.id,
        amount,
        discountAmount: seed.discountAmount,
        totalAmount: amount - seed.discountAmount,
        status: seed.status,
        dueDate: new Date(seed.dueDate),
        createdAt: new Date('2025-12-15'),
      },
    });
    for (const p of seed.payments) {
      const createdAt = new Date(p.date);
      const payment = await prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: p.amount,
          method: p.method,
          status: p.verified ? 'VERIFIED' : 'PENDING',
          receivedById: cashierUserId,
          verifiedById: p.verified ? financeOfficerUserId : null,
          verifiedAt: p.verified ? createdAt : null,
          createdAt,
        },
      });
      if (p.verified) {
        await prisma.receipt.create({
          data: { paymentId: payment.id, receiptNumber: `${receiptPrefix}-${payment.id.slice(0, 8).toUpperCase()}`, issuedAt: createdAt },
        });
      }
    }
    seededInvoices += 1;
  }

  // The graduate's certificate, so /student/certificates and the public
  // /verify/[token] page have a real one to show.
  let demoCertificate = demoStudentProfile
    ? await prisma.certificate.findFirst({ where: { studentId: demoStudentProfile.id, programId: nursingProgram.id } })
    : null;
  if (demoStudentProfile && !demoCertificate) {
    demoCertificate = await prisma.certificate.create({
      data: {
        organizationId: org.id,
        studentId: demoStudentProfile.id,
        programId: nursingProgram.id,
        certificateNumber: `${certificatePrefix}-2026-${randomBytes(4).toString('hex').toUpperCase()}`,
        qrToken: randomBytes(16).toString('hex'),
        issuedById: registrarUserId,
        issuedAt: new Date('2026-05-08'),
      },
    });
  }

  // A few notifications so the student's bell isn't empty; the newest two
  // stay unread.
  const NOTIFICATIONS_SEED: { type: string; title: string; body: string; createdAt: string; read: boolean }[] = demoCertificate
    ? [
        { type: 'payment.verified', title: 'Payment verified', body: 'Your payment of 6750.00 has been verified.', createdAt: '2026-02-14', read: true },
        { type: 'attempt.graded', title: 'Exam graded', body: 'Your NCLEX Mock Exam 1 result is now available.', createdAt: '2026-04-13', read: true },
        { type: 'certificate.issued', title: 'Certificate issued', body: `Your certificate ${demoCertificate.certificateNumber} is ready.`, createdAt: '2026-05-08', read: false },
        { type: 'announcement', title: 'New mock exam schedule', body: 'The October NCLEX mock exam is open for alumni. See the schedule page for dates.', createdAt: '2026-10-01', read: false },
      ]
    : [];

  let seededNotifications = 0;
  if (demoStudentUserId) {
    for (const seed of NOTIFICATIONS_SEED) {
      const existing = await prisma.notification.findFirst({ where: { userId: demoStudentUserId, type: seed.type, title: seed.title } });
      if (existing) continue;
      const createdAt = new Date(seed.createdAt);
      await prisma.notification.create({
        data: {
          organizationId: org.id,
          userId: demoStudentUserId,
          type: seed.type,
          title: seed.title,
          body: seed.body,
          createdAt,
          readAt: seed.read ? createdAt : null,
        },
      });
      seededNotifications += 1;
    }
  }

  console.log('Seeded organization:', org.slug);
  console.log('Seeded roles:', 3 + ROLE_CATALOG.length);
  console.log('Seeded super admin:', superAdminUser.email, `(password: ${adminPassword})`);
  console.log('Seeded branch manager:', northManagerUser.email, `(password: ${adminPassword}, branch: NORTH)`);
  console.log('Seeded student role permission holder key:', studentRole.key);
  console.log(`Seeded ${roleDemoUsers.length} per-role demo accounts (password: ${adminPassword}):`);
  for (const { email, role } of roleDemoUsers) {
    console.log(`  - ${role.name}: ${email}`);
  }
  console.log('Seeded leads:', seededLeads.length);
  console.log('Seeded admissions:', seededAdmissionsCount);
  console.log('Seeded curriculum:', nclexCourse.name);
  console.log(
    `  subjects: ${seededSubjects}, modules: ${seededModules}, lessons: ${seededLessons}, materials: ${seededMaterials}`,
  );
  console.log(
    `Seeded content: announcements: ${seededAnnouncements}, success stories: ${seededSuccessStories}, faq items: ${seededFaqItems}`,
  );
  console.log(`Seeded rooms: ${seededRooms}, classes: ${seededClasses}, schedules: ${seededSchedules}`);
  console.log('Seeded staff profiles:', seededStaff);
  console.log(
    'Seeded students:',
    studentProfiles.length,
    '| enrollments:',
    seededEnrollments,
    '| attendance records:',
    seededAttendance,
  );
  console.log('Seeded question bank items:', seededQuestions);
  console.log('Seeded pricing entries:', seededPricing);
  console.log(
    `Seeded demo data: exams: ${seededExams}, attempts: ${seededAttempts}, invoices: ${seededInvoices}, notifications: ${seededNotifications}`,
  );
  if (demoCertificate) {
    console.log(`Demo certificate ${demoCertificate.certificateNumber} — verify at /verify/${demoCertificate.qrToken}`);
  }
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log('⚠ This password was randomly generated and is only shown here — save it now.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
