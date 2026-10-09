// Per-role user guides, keyed by the role keys the seed creates (see
// apps/api/prisma/seed.ts ROLE_CATALOG plus super_admin / branch_manager /
// student). Each task names the permission its page needs, the same key the
// sidebar and the API check, so a guide never links someone to a page that
// would just redirect them. A custom role made in the app has no entry here
// and gets the generic guide instead.
//
// Steps use the labels the UI actually shows ("Start review", "Mark payment
// verified", ...), so keep them in sync when a page's wording changes.

export type GuidePortal = 'dashboard' | 'instructor' | 'student';

export interface GuideTask {
  title: string;
  /** Page the task happens on. */
  href?: string;
  /** Permission that unlocks `href`. Omit for pages everyone in the portal has. */
  permission?: string;
  steps: string[];
}

export interface RoleGuide {
  key: string;
  name: string;
  portal: GuidePortal;
  /** How far this role's access reaches, in plain words. */
  scope: string;
  summary: string;
  tasks: GuideTask[];
  tips?: string[];
}

const SCOPE = {
  global: 'Every branch and every record in the organization.',
  organization: 'Every branch in the organization.',
  branch: 'Only the branches you are assigned to. Records from other branches don’t appear.',
  assigned: 'Only the classes you are assigned to teach.',
  self: 'Only your own records.',
} as const;

// Shared tasks reused across several roles.
const T = {
  notifications: {
    title: 'Check your notifications',
    href: '/notifications',
    steps: [
      'The bell in the top bar shows how many notifications are unread.',
      'Open Notifications to read them and mark them as read.',
    ],
  },
  findStudent: {
    title: 'Look up a student',
    href: '/students',
    permission: 'students.view',
    steps: [
      'Open Students and search by name or filter by branch.',
      'Select a student to see their profile, enrollments, attendance, billing and certificates on one page.',
    ],
  },
  reports: {
    title: 'Read the reports',
    href: '/reports',
    permission: 'reports.view',
    steps: [
      'Open Reports for the enrollment funnel, collections, attendance and exam performance.',
      'Every number comes from recorded data in your access scope. Nothing is estimated.',
    ],
  },
  auditLogs: {
    title: 'Review the audit trail',
    href: '/audit-logs',
    permission: 'audit_logs.view',
    steps: [
      'Open Audit Logs to see who changed what, and when. Newest entries are first.',
      'The log is read-only. Entries can’t be edited or deleted by anyone.',
    ],
  },
  enrollmentPipeline: {
    title: 'Move an enrollment through the pipeline',
    href: '/enrollments',
    permission: 'enrollments.update',
    steps: [
      'Open Enrollments. The “Waiting on staff” filter shows applications that need you.',
      'Open an application and use Start review, then Approve, Missing requirements or Reject.',
      'After approval, use Request payment. Once Finance verifies a payment, use Mark payment verified, then Enroll.',
      'Enroll notifies the student and opens their learning access.',
    ],
  },
} satisfies Record<string, GuideTask>;

export const ROLE_GUIDES: Record<string, RoleGuide> = {
  // --- Platform / Executive --------------------------------------------------
  super_admin: {
    key: 'super_admin',
    name: 'Super Admin',
    portal: 'dashboard',
    scope: SCOPE.global,
    summary:
      'You hold every permission. You set up the organization, decide who can do what, and step in when no other role can.',
    tasks: [
      {
        title: 'Set up the center',
        href: '/settings',
        permission: 'settings.manage',
        steps: [
          'In Settings, fill in the center’s name, contact details, enrollment banner and numbering for receipts and certificates.',
          'Add each location under Branches, then its rooms under Classes → Rooms.',
          'Create programs under Programs, then their courses under Courses.',
        ],
      },
      {
        title: 'Give staff access',
        href: '/staff',
        permission: 'staff.create',
        steps: [
          'Add the person under Staff and assign them to the branches they work at.',
          'Under Roles, give them the role that matches their job. Each role’s permissions are listed there.',
          'Branch-scoped roles only see their assigned branches, so check the branch list before you save.',
        ],
      },
      {
        title: 'Create or adjust a role',
        href: '/roles',
        permission: 'roles.manage',
        steps: [
          'Open Roles and choose New role, or open an existing custom role to edit it.',
          'Tick the permissions it needs and choose how far they reach (branch, organization, …).',
          'System roles from the seed can’t be deleted. Copy one into a custom role if you need a variation.',
        ],
      },
      T.reports,
      T.auditLogs,
    ],
    tips: [
      'Use a lower-privilege account for daily work. Super Admin is the break-glass role.',
      'Refund approvals are split between two roles on purpose, so no one person can approve a refund alone. Don’t combine them on a custom role.',
    ],
  },
  owner_executive: {
    key: 'owner_executive',
    name: 'Owner / Executive',
    portal: 'dashboard',
    scope: SCOPE.organization,
    summary:
      'You watch how the whole center is doing: enrollment, revenue, exam results. You also own what the public website says.',
    tasks: [
      {
        title: 'Check the center’s health',
        href: '/dashboard',
        steps: [
          'The dashboard shows total students, published courses, graded exam attempts and revenue collected, with month-over-month change.',
          'Below that are enrollment trends, the enrollment funnel and the latest activity.',
        ],
      },
      T.reports,
      {
        title: 'Publish website content',
        href: '/content',
        permission: 'content.manage',
        steps: [
          'Open Content and pick Announcements, Success stories or FAQ.',
          'Draft an item, then use Submit for review → Approve → Publish. It goes live on the public site when published.',
          'Use Archive to take an item down without deleting it.',
        ],
      },
      {
        title: 'Look at the money',
        href: '/finance',
        permission: 'payments.view',
        steps: [
          'Finance lists invoices, payments, refunds and program prices. Your access is view-only.',
          'Invoice status is worked out by the server from verified payments, so “Paid” always means money was verified.',
        ],
      },
      T.auditLogs,
    ],
  },
  operations_manager: {
    key: 'operations_manager',
    name: 'Operations Manager',
    portal: 'dashboard',
    scope: SCOPE.organization,
    summary: 'You run the logistics: branches, rooms, classes and weekly schedules, so every session has a room and an instructor.',
    tasks: [
      {
        title: 'Add a branch',
        href: '/branches',
        permission: 'branches.create',
        steps: ['Open Branches and choose New branch.', 'Give it a name and code. Staff and classes can then be assigned to it.'],
      },
      {
        title: 'Set up rooms and classes',
        href: '/classes',
        permission: 'classes.create',
        steps: [
          'Open Classes. Under Rooms, add each branch’s rooms first.',
          'Choose New class and link it to a batch, a course, a room and an instructor.',
          'The “Needs attention” list flags classes missing a room, an instructor or a schedule.',
        ],
      },
      {
        title: 'Schedule meeting times',
        href: '/schedules',
        permission: 'schedules.create',
        steps: [
          'Open Schedule, pick a class and choose Add meeting time.',
          'Set the day and start and end times. The system blocks room and instructor double-bookings.',
          '“Week at a glance” shows the whole week so you can spot gaps.',
        ],
      },
      {
        title: 'Follow enrollments',
        href: '/enrollments',
        permission: 'enrollments.view',
        steps: ['Open Enrollments to see each application’s stage and how many are waiting on staff.'],
      },
      T.reports,
    ],
  },
  branch_manager: {
    key: 'branch_manager',
    name: 'Branch Manager',
    portal: 'dashboard',
    scope: SCOPE.branch,
    summary: 'You oversee one branch’s students, enrollments and attendance. Everything you see is limited to your branch.',
    tasks: [
      T.findStudent,
      {
        title: 'Follow your branch’s enrollments',
        href: '/enrollments',
        permission: 'enrollments.view',
        steps: ['Open Enrollments. Use the pipeline view to see how many applications sit at each stage.'],
      },
      {
        title: 'Check attendance',
        href: '/attendance',
        permission: 'attendance.view',
        steps: ['Open Attendance and pick a class to see who was present, late or absent at each session.'],
      },
      T.notifications,
    ],
  },

  // --- Academic --------------------------------------------------------------
  academic_director: {
    key: 'academic_director',
    name: 'Academic Director',
    portal: 'dashboard',
    scope: SCOPE.organization,
    summary:
      'You own what is taught: programs, courses and curriculum. You give final approval on exams, and you manage the instructor roster.',
    tasks: [
      {
        title: 'Build a program',
        href: '/programs',
        permission: 'programs.create',
        steps: [
          'Open Programs and choose New program (for example, Nursing or Midwifery).',
          'Add its courses under Courses. Publish the program when it’s ready to accept enrollments.',
        ],
      },
      {
        title: 'Approve curriculum',
        href: '/curriculum',
        permission: 'courses.view',
        steps: [
          'Open Curriculum, pick a program and course, and work through subjects, modules, lessons and materials.',
          'Items move Draft → In review → Approved → Published. Students only see published items.',
          'Use Send back to return an item to its author with changes needed.',
        ],
      },
      {
        title: 'Approve and publish exams',
        href: '/exams',
        permission: 'exams.approve',
        steps: [
          'Open Exams → Question bank. The “In review” count shows questions waiting for you.',
          'Approve good questions. Only approved questions can go into an exam.',
          'On the Exams tab, open a finished exam and choose Publish exam. This locks the question set and opens the exam to students.',
        ],
      },
      T.reports,
    ],
  },
  lead_instructor: {
    key: 'lead_instructor',
    name: 'Lead Instructor',
    portal: 'instructor',
    scope: SCOPE.branch,
    summary:
      'You teach, take attendance and grade like any instructor. You also write exams and keep course content current for your branch.',
    tasks: [
      {
        title: 'Start your day',
        href: '/instructor',
        steps: [
          'Today shows your sessions for the day, your attendance rate and how many attempts are waiting for a grade.',
          'Select a session in the schedule to go straight to its attendance sheet.',
        ],
      },
      {
        title: 'Take attendance',
        href: '/instructor/attendance',
        permission: 'attendance.create',
        steps: [
          'Open Attendance and pick the class and date.',
          'Mark each student Present, Late, Absent or Excused. Changes save as you go.',
        ],
      },
      {
        title: 'Grade submissions',
        href: '/instructor/grading',
        permission: 'exams.grade',
        steps: [
          'Open Grading to see attempts that need a person to score them, such as essays.',
          'Score each answer and finalize. The student sees the result once grading is done.',
        ],
      },
      {
        title: 'Write questions and exams',
        href: '/exams',
        permission: 'exams.create',
        steps: [
          'Exam authoring is in the admin workspace under Exams.',
          'Add questions in the Question bank and submit them for review.',
          'Create an exam on the Exams tab, then choose “Add from the question bank”. Only approved questions can be added.',
        ],
      },
    ],
  },
  instructor: {
    key: 'instructor',
    name: 'Instructor',
    portal: 'instructor',
    scope: SCOPE.assigned,
    summary: 'You teach your assigned classes, take attendance at each session and grade the work students submit.',
    tasks: [
      {
        title: 'Start your day',
        href: '/instructor',
        steps: [
          'Today shows your sessions for the day, your 30-day attendance rate and how many attempts are waiting for a grade.',
          'If you have no sessions today, it shows your next upcoming ones instead.',
        ],
      },
      {
        title: 'See your classes and rosters',
        href: '/instructor/classes',
        permission: 'classes.view',
        steps: ['Open Classes to see each class you teach, its room, meeting times and enrolled students.'],
      },
      {
        title: 'Take attendance',
        href: '/instructor/attendance',
        permission: 'attendance.create',
        steps: [
          'Open Attendance and pick the class and date.',
          'Mark each student Present, Late, Absent or Excused. You can correct a mark later on the same sheet.',
        ],
      },
      {
        title: 'Grade submissions',
        href: '/instructor/grading',
        permission: 'exams.grade',
        steps: [
          'Open Grading. Multiple-choice answers are scored automatically. Only answers that need judgment, such as essays, wait here.',
          'Score each answer and finalize the attempt. The student sees the result once grading is done.',
        ],
      },
    ],
    tips: ['You only see the classes you’re assigned to. If one is missing, ask Operations to assign you to it.'],
  },
  content_manager: {
    key: 'content_manager',
    name: 'Content Manager',
    portal: 'dashboard',
    scope: SCOPE.organization,
    summary: 'You create and maintain course material: subjects, modules, lessons, videos and handouts.',
    tasks: [
      {
        title: 'Add a course',
        href: '/courses',
        permission: 'courses.create',
        steps: ['Open Courses and choose New course under the right program.', 'Publish it when its curriculum is ready.'],
      },
      {
        title: 'Write lessons and upload materials',
        href: '/curriculum',
        permission: 'courses.view',
        steps: [
          'Open Curriculum, pick a program and course, then pick or add a subject.',
          'Add modules, then lessons inside them, then materials such as text, video, PDF or flashcards.',
          'Use Submit for review when an item is ready. Once it’s approved, Publish makes it visible to students.',
        ],
      },
      {
        title: 'Keep program details current',
        href: '/programs',
        permission: 'programs.update',
        steps: ['Open Programs to update a program’s description and details.'],
      },
    ],
  },
  exam_administrator: {
    key: 'exam_administrator',
    name: 'Exam Administrator',
    portal: 'dashboard',
    scope: SCOPE.organization,
    summary: 'You run the question bank and the exam calendar: you review questions, assemble exams and publish them to students.',
    tasks: [
      {
        title: 'Review questions',
        href: '/exams',
        permission: 'exams.approve',
        steps: [
          'Open Exams → Question bank and filter to “In review”.',
          'Approve questions that are correct and clear, or send them back to draft.',
        ],
      },
      {
        title: 'Build an exam',
        href: '/exams',
        permission: 'exams.create',
        steps: [
          'On the Exams tab choose New exam. Set its type, time limit, attempt limit and passing score.',
          'Turn on shuffling if each student should see questions and choices in a different order.',
          'Choose “Add from the question bank” to fill it with approved questions.',
        ],
      },
      {
        title: 'Publish an exam',
        href: '/exams',
        permission: 'exams.publish',
        steps: [
          'Open the exam and choose Publish exam.',
          'Publishing locks the question set and opens the exam to students in that program.',
        ],
      },
    ],
  },

  // --- Operations ------------------------------------------------------------
  registrar: {
    key: 'registrar',
    name: 'Registrar',
    portal: 'dashboard',
    scope: SCOPE.branch,
    summary: 'You keep student records accurate and move each enrollment from application to enrolled.',
    tasks: [
      {
        title: 'Register a student',
        href: '/students',
        permission: 'students.create',
        steps: [
          'Open Students and choose New student.',
          'Enter their details and branch. If online sign-up is on in Settings, students can also register themselves.',
        ],
      },
      {
        title: 'Create an enrollment',
        href: '/enrollments',
        permission: 'enrollments.create',
        steps: ['Open Enrollments and choose New enrollment.', 'Pick the student, program and batch, then use Submit application.'],
      },
      T.enrollmentPipeline,
      T.findStudent,
    ],
    tips: ['“Mark payment verified” only works after Finance has verified a payment on the student’s invoice.'],
  },
  admissions_officer: {
    key: 'admissions_officer',
    name: 'Admissions Officer',
    portal: 'dashboard',
    scope: SCOPE.branch,
    summary: 'You turn inquiries into enrolled reviewees: you follow up on leads, review applications and start enrollments.',
    tasks: [
      {
        title: 'Work your leads',
        href: '/leads',
        permission: 'leads.update',
        steps: [
          'Open Leads. The “Unassigned” filter shows open leads no one owns yet.',
          'Open a lead to read its message and add a follow-up note with a due date.',
          'Move it along with Mark as inquiry → Mark as application → Mark as applicant → Mark as enrolled.',
        ],
      },
      {
        title: 'Review an admission',
        href: '/admissions',
        permission: 'admissions.review',
        steps: [
          'When a lead reaches the Application stage, start an admission review for it on Admissions.',
          'Work the Review queue: move each one to Under review, then Approve or Reject.',
        ],
      },
      {
        title: 'Start the enrollment',
        href: '/enrollments',
        permission: 'enrollments.create',
        steps: ['Once approved, choose New enrollment on Enrollments for the student’s program and batch.'],
      },
    ],
  },
  front_desk_staff: {
    key: 'front_desk_staff',
    name: 'Front Desk Staff',
    portal: 'dashboard',
    scope: SCOPE.branch,
    summary: 'You’re the first contact: you log walk-ins, calls and messages, and answer quick questions about students.',
    tasks: [
      {
        title: 'Log an inquiry',
        href: '/leads',
        permission: 'leads.create',
        steps: [
          'Open Leads and choose New lead for every walk-in, call or message, so nobody falls through the cracks.',
          'Record their contact details, the program they asked about and how they found the center.',
        ],
      },
      T.findStudent,
      {
        title: 'Check an enrollment’s status',
        href: '/enrollments',
        permission: 'enrollments.view',
        steps: ['Open Enrollments and search for the student to tell them what stage their application is at.'],
      },
    ],
  },
  general_staff: {
    key: 'general_staff',
    name: 'General Staff',
    portal: 'dashboard',
    scope: SCOPE.branch,
    summary: 'You have view access to student records and attendance for your branch.',
    tasks: [
      T.findStudent,
      {
        title: 'Check attendance',
        href: '/attendance',
        permission: 'attendance.view',
        steps: ['Open Attendance and pick a class to see each session’s marks.'],
      },
      T.notifications,
    ],
  },

  // --- Finance ---------------------------------------------------------------
  finance_manager: {
    key: 'finance_manager',
    name: 'Finance Manager',
    portal: 'dashboard',
    scope: SCOPE.branch,
    summary: 'You set prices, verify payments, give final approval on refunds and keep an eye on collections.',
    tasks: [
      {
        title: 'Set program prices',
        href: '/finance',
        permission: 'pricing.create',
        steps: ['Open Finance → Pricing and set the fee for each program. New invoices use the current price.'],
      },
      {
        title: 'Verify payments',
        href: '/finance',
        permission: 'payments.verify',
        steps: [
          'Open Finance → Payments and find payments marked Pending.',
          'Check them against the receipt or bank record, then verify or reject.',
          'A verified payment updates the invoice status automatically and notifies the student.',
        ],
      },
      {
        title: 'Approve and process refunds',
        href: '/finance',
        permission: 'refunds.manager_approve',
        steps: [
          'Open Finance → Refunds. Requests a Finance Officer has already approved are waiting for you.',
          'Approve or reject. Once approved, process the refund when the money has been returned.',
        ],
      },
      T.reports,
    ],
    tips: ['You give the second, final approval on refunds. The first approval comes from a Finance Officer, so no one person can approve a refund alone.'],
  },
  finance_officer: {
    key: 'finance_officer',
    name: 'Finance Officer',
    portal: 'dashboard',
    scope: SCOPE.branch,
    summary: 'You bill students, record and verify payments, and give the first approval on refund requests.',
    tasks: [
      {
        title: 'Create an invoice',
        href: '/finance',
        permission: 'invoices.create',
        steps: [
          'Open Finance → Invoices and choose New invoice once a student’s enrollment is approved.',
          'The amount defaults to the program’s current price.',
        ],
      },
      {
        title: 'Record and verify a payment',
        href: '/finance',
        permission: 'payments.verify',
        steps: [
          'On an invoice choose Record payment and enter the amount, method and reference.',
          'Verify it on the Payments tab once you’ve confirmed the money arrived.',
        ],
      },
      {
        title: 'Approve a refund request',
        href: '/finance',
        permission: 'refunds.officer_approve',
        steps: [
          'Open Finance → Refunds and review requests with status Requested.',
          'Approve to send it on to the Finance Manager, or reject it with a reason.',
        ],
      },
    ],
  },
  cashier: {
    key: 'cashier',
    name: 'Cashier',
    portal: 'dashboard',
    scope: SCOPE.branch,
    summary: 'You take payments at the counter and record them against the student’s invoice.',
    tasks: [
      {
        title: 'Record a payment',
        href: '/finance',
        permission: 'payments.create',
        steps: [
          'Open Finance → Invoices and find the student’s invoice.',
          'Choose Record payment and enter the amount, method and receipt reference.',
          'The payment stays Pending until a Finance Officer or Manager verifies it.',
        ],
      },
      {
        title: 'Request a refund',
        href: '/finance',
        permission: 'refunds.create',
        steps: [
          'Open Finance → Refunds and choose Request refund.',
          'Pick the verified payment and give the amount and reason. Finance approves it in two steps before it’s paid out.',
        ],
      },
    ],
  },

  // --- Human Resources -------------------------------------------------------
  hr_manager: {
    key: 'hr_manager',
    name: 'HR Manager',
    portal: 'dashboard',
    scope: SCOPE.organization,
    summary: 'You maintain the staff directory and user accounts so people have the right login.',
    tasks: [
      {
        title: 'Add a staff member',
        href: '/staff',
        permission: 'staff.create',
        steps: [
          'Open Staff and choose Add staff member.',
          'Enter their details and assign the branches they work at.',
          'Ask a Super Admin to give them the right role if they need more than a basic login.',
        ],
      },
      {
        title: 'Update or deactivate staff',
        href: '/staff',
        permission: 'staff.update',
        steps: ['Open a staff member and choose Edit to change their details, branches or status.'],
      },
      {
        title: 'Review center settings',
        href: '/settings',
        permission: 'settings.view',
        steps: ['Settings shows the center’s name, contact details and notification defaults. Your access is view-only.'],
      },
    ],
  },
  hr_staff: {
    key: 'hr_staff',
    name: 'HR Staff',
    portal: 'dashboard',
    scope: SCOPE.organization,
    summary: 'You keep the staff directory current.',
    tasks: [
      {
        title: 'Add a staff member',
        href: '/staff',
        permission: 'staff.create',
        steps: ['Open Staff and choose Add staff member.', 'Enter their details and assign the branches they work at.'],
      },
      {
        title: 'Update staff details',
        href: '/staff',
        permission: 'staff.update',
        steps: ['Open a staff member and choose Edit.'],
      },
    ],
  },

  // --- Compliance ------------------------------------------------------------
  auditor: {
    key: 'auditor',
    name: 'Auditor',
    portal: 'dashboard',
    scope: `${SCOPE.organization} Your access is read-only.`,
    summary: 'You independently check records: who changed what, where the money went and how students are doing. You can’t change anything.',
    tasks: [
      T.auditLogs,
      {
        title: 'Trace a payment or refund',
        href: '/finance',
        permission: 'payments.view',
        steps: [
          'Open Finance. Invoices, Payments and Refunds each show their status history.',
          'Match a refund to its payment and check that both approval steps were done by different people.',
        ],
      },
      T.reports,
      T.findStudent,
    ],
    tips: ['Your role is read-only by design. It can never be given create, approve or manage permissions.'],
  },

  // --- Students ---------------------------------------------------------------
  student: {
    key: 'student',
    name: 'Student',
    portal: 'student',
    scope: SCOPE.self,
    summary: 'Your portal for the review: classes, lessons, practice exams, scores and your certificate.',
    tasks: [
      {
        title: 'Check today’s schedule',
        href: '/student/schedule',
        steps: ['Home shows today’s classes. Schedule has the full week with rooms and times.'],
      },
      {
        title: 'Study your lessons',
        href: '/student/learn',
        steps: [
          'My Courses lists your program’s courses with their subjects and lessons.',
          'Video Lessons and Study Materials collect every video and handout in one place.',
        ],
      },
      {
        title: 'Take a practice exam or quiz',
        href: '/student/exams',
        steps: [
          'Open Practice Exams or Quizzes and choose an open exam.',
          'Check the time limit and attempts left before you start. The timer keeps running if you leave the page.',
          'Some exams show your score right away. Others show “Awaiting results” until they’re graded.',
        ],
      },
      {
        title: 'Track your progress',
        href: '/student/progress',
        steps: ['Progress shows your average score, pass rate and attendance, and how your scores have moved over time.'],
      },
      {
        title: 'Get your certificate',
        href: '/student/certificates',
        steps: [
          'Your certificate appears under Certificates once it’s issued.',
          'Copy its verification link to share with employers or the licensing board.',
        ],
      },
    ],
    tips: ['Contact details and your password are under Settings. For enrollment or payment questions, see Help & Support.'],
  },
};

// Order a user's roles so the guide they most likely need comes first: the
// one for the portal they're in, then the rest in catalog order.
export function guidesForRoles(roleKeys: string[], portal?: GuidePortal): RoleGuide[] {
  const guides = roleKeys.map((key) => ROLE_GUIDES[key]).filter((g): g is RoleGuide => Boolean(g));
  if (!portal) return guides;
  return [...guides.filter((g) => g.portal === portal), ...guides.filter((g) => g.portal !== portal)];
}

// For a custom role with no written guide: one task per page the account can
// open, built from the same nav items the shell already filters.
export function genericGuide(pages: { label: string; href: string }[]): RoleGuide {
  return {
    key: 'custom',
    name: 'Your role',
    portal: 'dashboard',
    scope: 'Set by your administrator. Pages outside your access don’t appear in the menu.',
    summary: 'Your account uses a custom role. These are the sections it can open.',
    tasks: pages
      .filter((p) => p.href !== '/dashboard')
      .map((p) => ({ title: p.label, href: p.href, steps: [`Open ${p.label} from the menu.`] })),
    tips: ['If you need a section you can’t see, ask your administrator to add it to your role.'],
  };
}
