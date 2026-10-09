import { adminIcons, type AdminNavGroup } from '@/components/admin-shell';

// Nav is role-aware, not role-name-aware (blueprint Section 25): each item
// names the permission that unlocks it, and the guard is the same
// `hasPermission` check the API itself enforces — never a hardcoded role
// check like `user.roles.includes('admin')`. Grouped to match the
// reference dashboard's sectioned sidebar (Users Management, Courses &
// Content, ...); a group of one item (Dashboard, Reports, ...) renders as
// a plain top-level link instead of a collapsible section.
//
// Lives outside (dashboard)/layout.tsx so the user guide can list a custom
// role's pages from the same source the sidebar uses.
export const NAV_GROUPS: AdminNavGroup[] = [
  { label: 'Overview', items: [{ label: 'Dashboard', href: '/dashboard', icon: adminIcons.home }] },
  {
    label: 'Enrollment Pipeline',
    items: [
      { label: 'Leads', href: '/leads', icon: adminIcons.funnel, permission: 'leads.view' },
      { label: 'Admissions', href: '/admissions', icon: adminIcons.clipboardCheck, permission: 'admissions.view' },
      { label: 'Enrollments', href: '/enrollments', icon: adminIcons.userPlus, permission: 'enrollments.view' },
      { label: 'Students', href: '/students', icon: adminIcons.users, permission: 'students.view' },
    ],
  },
  {
    label: 'Courses & Content',
    items: [
      { label: 'Programs', href: '/programs', icon: adminIcons.layers, permission: 'programs.view' },
      { label: 'Courses', href: '/courses', icon: adminIcons.learn, permission: 'courses.view' },
      { label: 'Curriculum', href: '/curriculum', icon: adminIcons.layers, permission: 'courses.view' },
      { label: 'Content', href: '/content', icon: adminIcons.fileText, permission: 'content.view' },
      { label: 'Classes', href: '/classes', icon: adminIcons.users, permission: 'classes.view' },
      { label: 'Schedule', href: '/schedules', icon: adminIcons.schedule, permission: 'schedules.view' },
    ],
  },
  {
    label: 'Exams & Attendance',
    items: [
      { label: 'Attendance', href: '/attendance', icon: adminIcons.checkSquare, permission: 'attendance.view' },
      { label: 'Exams', href: '/exams', icon: adminIcons.exams, permission: 'exams.view' },
      { label: 'Results', href: '/results', icon: adminIcons.barChart, permission: 'exams.grade' },
    ],
  },
  {
    label: 'Payments & Billing',
    items: [{ label: 'Finance', href: '/finance', icon: adminIcons.creditCard, permission: 'payments.view' }],
  },
  {
    label: 'Reports & Analytics',
    items: [{ label: 'Reports', href: '/reports', icon: adminIcons.pieChart, permission: 'reports.view' }],
  },
  {
    label: 'Users Management',
    items: [
      { label: 'Staff', href: '/staff', icon: adminIcons.users, permission: 'staff.view' },
      { label: 'Branches', href: '/branches', icon: adminIcons.mapPin, permission: 'branches.view' },
      { label: 'Roles', href: '/roles', icon: adminIcons.shield, permission: 'roles.manage' },
      { label: 'Permissions', href: '/permissions', icon: adminIcons.key, permission: 'permissions.manage' },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Notifications', href: '/notifications', icon: adminIcons.bell },
      { label: 'Audit Logs', href: '/audit-logs', icon: adminIcons.history, permission: 'audit_logs.view' },
      { label: 'Settings', href: '/settings', icon: adminIcons.settings, permission: 'settings.view' },
      { label: 'User Guide', href: '/guide', icon: adminIcons.help },
    ],
  },
];

export function visibleNavGroups(hasPermission: (key: string) => boolean): AdminNavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || hasPermission(item.permission)),
  })).filter((group) => group.items.length > 0);
}
