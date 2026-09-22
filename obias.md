# OBIAS Nursing & Allied Courses Review Center
## Full-Stack Product Architecture & Engineering Master Prompt

You are acting as a senior software architect, senior full-stack engineer, senior UX/UI designer, product architect, database architect, security engineer, and technical project lead.

Your job is to help design and eventually implement a production-grade, mobile-first web application for a healthcare review and training center.

The project is for:

**OBIAS Nursing & Allied Courses Review Center**

The system must be designed as a complete business platform rather than simply a marketing website or basic Learning Management System.

---

# 1. PROJECT VISION

Build a modern, mobile-first Review Center Management + Learning Management + Student Portal platform.

The platform should allow the organization to manage its entire operation from top-level management down to individual students.

The system should cover:

- Public website
- Marketing
- Program discovery
- Online inquiries
- Admissions
- Student applications
- Enrollment
- Student management
- Programs
- Courses
- Subjects
- Classes
- Schedules
- Rooms
- Branches
- Instructors
- Staff
- Attendance
- Learning materials
- Question banks
- Quizzes
- Exams
- Grading
- Student performance
- Progress tracking
- Payments
- Invoices
- Receipts
- Refunds
- Certificates
- Notifications
- Reports
- Analytics
- Roles
- Permissions
- Approval workflows
- Audit logs
- System settings

The system must be designed so it can grow from a single review center into a multi-branch organization without requiring a major architectural rewrite.

---

# 2. CORE PRODUCT PRINCIPLE

Do NOT treat this as a simple website.

Think of the product as four interconnected systems:

1. Public Website
2. Student Platform
3. Staff / Instructor Platform
4. Management / Administration Platform

All four should share the same backend, identity system, database, authorization system, and design system.

High-level architecture:

    PUBLIC WEBSITE
          |
          v
    WEB / PWA APPLICATION
          |
          v
       API LAYER
          |
    +-----+---------------------+
    |                           |
    v                           v
IDENTITY & AUTH            CORE PLATFORM
    |                           |
Users                       Students
Roles                       Enrollment
Permissions                 Programs
Organizations               Courses
Branches                    Classes
Audit                       Scheduling
                            Attendance
                            Finance
                            |
                            v
                       LEARNING ENGINE
                            |
                       Lessons
                       Materials
                       Questions
                       Exams
                       Results
                       Progress

---

# 3. DESIGN PHILOSOPHY

The application must be:

- Mobile-first
- Responsive
- Accessible
- Fast
- Secure
- Maintainable
- Scalable
- Modular
- Easy to operate
- Easy to administer
- Easy to extend

Do not blindly reproduce traditional school-management software.

The UX should combine:

- Healthcare professionalism
- Academic credibility
- Modern EdTech
- Clean SaaS interfaces
- Strong visual hierarchy
- Simple mobile workflows

The existing organization's branding should be respected, but the application UI should be significantly cleaner and more modern than a traditional promotional flyer.

---

# 4. PRIMARY USERS

Design the system around these user types.

## Platform / Executive

- Super Admin
- Owner / Executive
- Operations Manager

## Academic

- Academic Director
- Lead Instructor
- Instructor
- Content Manager
- Exam Administrator

## Operations

- Branch Manager
- Registrar
- Admissions Officer
- Front Desk Staff
- General Staff

## Finance

- Finance Manager
- Finance Officer
- Cashier

## Human Resources

- HR Manager
- HR Staff

## External / Learner

- Student
- Parent / Guardian (optional future role)

## Compliance

- Auditor

Do not assume every organization will use every role.

The architecture must allow administrators to create custom roles.

---

# 5. AUTHENTICATION AND IDENTITY

Use a centralized identity model.

Do NOT make separate authentication systems for students, instructors, and administrators.

Use:

    User
      |
      +-- Student Profile
      |
      +-- Instructor Profile
      |
      +-- Staff Profile
      |
      +-- Roles
      |
      +-- Permissions

A single person may have multiple roles.

For example:

    User
      |
      +-- Instructor
      +-- Academic Director

The user should still have one identity/account.

---

# 6. RBAC + SCOPED AUTHORIZATION

The authorization system is one of the most important parts of the application.

Do NOT implement authorization using simplistic logic such as:

    if user.role === "admin"

Instead implement:

**RBAC + Permission + Scope + Policy**

Conceptually:

    USER
      |
    ROLE
      |
    PERMISSION
      |
    RESOURCE
      |
    ACTION
      |
    SCOPE
      |
    POLICY

Examples of permissions:

    students.view
    students.create
    students.update
    students.archive
    students.export

    programs.view
    programs.create
    programs.update
    programs.publish
    programs.archive

    courses.view
    courses.create
    courses.update
    courses.publish

    exams.view
    exams.create
    exams.update
    exams.approve
    exams.publish
    exams.grade

    payments.view
    payments.create
    payments.verify

    refunds.create
    refunds.approve

    reports.view
    reports.export

    users.manage
    roles.manage
    permissions.manage
    audit_logs.view

---

# 7. AUTHORIZATION SCOPES

Permissions must support scope.

Recommended scopes:

- global
- organization
- branch
- department
- program
- course
- class
- assigned
- self

Example:

Instructor:

    students.view
    scope = assigned_classes

Branch Manager:

    students.view
    scope = branch

Student:

    results.view
    scope = self

Super Admin:

    students.view
    scope = global

This is mandatory for long-term scalability.

---

# 8. ORGANIZATION AND BRANCH ARCHITECTURE

Even if the organization currently operates from one primary center, design the system for multiple branches.

Model:

    Organization
       |
       +-- Branch
       |     |
       |     +-- Rooms
       |     +-- Staff
       |     +-- Classes
       |     +-- Students
       |
       +-- Branch
       |
       +-- Branch

Relevant entities should support:

    organization_id
    branch_id

where appropriate.

The system should eventually support:

- Multiple branches
- Branch-specific users
- Branch-specific students
- Branch-specific classes
- Branch-specific rooms
- Branch-specific schedules
- Branch-specific reports
- Branch-specific financial visibility

---

# 9. PUBLIC WEBSITE

Create a public-facing website containing:

- Home
- About
- Programs
- Courses
- Instructors
- Schedules
- Branches / Locations
- Announcements
- Events
- Success Stories
- FAQs
- Contact
- Enrollment
- Login
- Registration

The primary conversion action should be:

**Enroll Now**

Secondary conversion actions:

- Inquire
- View Programs
- View Schedule
- Contact Center

---

# 10. PROGRAM MANAGEMENT

Programs should be dynamic.

Do not hard-code Nursing into the architecture.

Model:

    Program
       |
       +-- Courses
       |
       +-- Subjects
       |
       +-- Curriculum
       |
       +-- Batches
       |
       +-- Schedules
       |
       +-- Pricing

The platform should support programs such as:

- Nursing
- Midwifery
- Medical Technology
- Physical Therapy
- Caregiving
- Seminar & Training
- Foreign Language Skills

Additional programs should be possible without code changes.

---

# 11. STUDENT APPLICATION AND ENROLLMENT

Create a complete enrollment workflow.

Recommended flow:

    Program Selection
          |
    Schedule / Batch
          |
    Account Creation
          |
    Student Information
          |
    Requirements
          |
    Payment
          |
    Verification
          |
    Enrollment Approval
          |
    Student Account Activated
          |
    Learning Access

The workflow should support statuses such as:

- Draft
- Submitted
- Under Review
- Requirements Incomplete
- Approved
- Payment Pending
- Payment Verified
- Enrolled
- Cancelled
- Rejected
- Completed

---

# 12. STUDENT PROFILE

Student records should support:

- Personal information
- Contact information
- Emergency contact
- Educational background
- Program
- Enrollment history
- Branch
- Batch
- Classes
- Attendance
- Payments
- Exam attempts
- Scores
- Progress
- Certificates
- Uploaded requirements

Sensitive information must be properly protected.

---

# 13. LEARNING MANAGEMENT SYSTEM

The learning system should use this hierarchy:

    Program
       |
    Subject
       |
    Module
       |
    Lesson
       |
    Learning Material

Materials may include:

- Text
- Images
- PDF
- Documents
- Video
- Audio
- Downloads
- Flashcards
- Quizzes
- Practice questions

Content must support:

    Draft
       |
    Review
       |
    Approved
       |
    Published
       |
    Archived

---

# 14. QUESTION BANK

Create a reusable question bank.

A question should support:

- Program
- Subject
- Topic
- Difficulty
- Competency
- Tags
- Question type
- Question content
- Options
- Correct answer
- Explanation
- Reference
- Status
- Author
- Reviewer
- Approval status

Question types should include:

- Multiple Choice
- Multiple Response
- True / False
- Identification
- Numerical
- Essay
- Image-based

Questions should not belong permanently to one exam.

Exams should select questions from the question bank.

---

# 15. EXAM ENGINE

Build a reusable assessment engine.

Support:

- Practice quizzes
- Diagnostic tests
- Mock exams
- Final assessments
- Timed exams
- Random questions
- Random answer choices
- Question pools
- Attempt limits
- Passing scores
- Auto grading
- Manual grading
- Partial credit
- Answer explanations
- Delayed result release
- Immediate result release

Track:

- Attempt
- Answers
- Score
- Time
- Correct answers
- Incorrect answers
- Subject performance
- Topic performance

---

# 16. STUDENT PERFORMANCE

The platform should track:

- Quiz performance
- Exam performance
- Attendance
- Course completion
- Lesson completion
- Study progress
- Subject performance
- Weak areas
- Improvement over time

Example:

    Anatomy             91%
    Pharmacology        73%
    Medical-Surgical    84%
    Maternal Nursing    63%
    Community Health    89%

The system should eventually support personalized recommendations.

---

# 17. INSTRUCTOR PORTAL

Instructor dashboard should provide:

- Today's classes
- Assigned students
- Attendance
- Assessments
- Grading
- Question bank
- Learning materials
- Announcements
- Student performance
- Reports

Instructors should only access data allowed by their assigned permissions and scopes.

---

# 18. CLASS MANAGEMENT

Classes should support:

- Program
- Course
- Batch
- Instructor
- Students
- Branch
- Room
- Schedule
- Status

Support class states:

- Scheduled
- Active
- Completed
- Cancelled
- Archived

---

# 19. SCHEDULING

Create a scheduling engine.

Entities:

    Branch
       |
    Room
       |
    Class
       |
    Schedule
       |
    Instructor
       |
    Students

Prevent:

- Instructor conflicts
- Room conflicts
- Class conflicts

The system should detect overlapping schedules before publishing them.

---

# 20. ATTENDANCE

Support:

- Present
- Absent
- Late
- Excused

Possible methods:

1. Instructor manual attendance
2. Student QR attendance
3. Future optional location/time validation

Attendance should be linked to:

- Student
- Class
- Schedule
- Instructor
- Date
- Time
- Branch

---

# 21. FINANCE

Create a financial subsystem.

Entities:

    Program
       |
    Pricing
       |
    Invoice
       |
    Payment
       |
    Receipt

Support:

- Full payment
- Partial payment
- Installment
- Discount
- Scholarship
- Refund
- Payment verification
- Outstanding balance
- Payment history

Financial permissions must be tightly restricted.

---

# 22. CERTIFICATES

Support certificates for:

- Training
- Seminars
- Courses
- Review completion
- Other eligible programs

Certificates should have:

- Unique certificate number
- Student
- Program
- Completion date
- Issuing organization
- QR verification

Provide a public verification mechanism.

---

# 23. CRM / ADMISSIONS

Create a lead-to-student pipeline.

    Lead
      |
    Inquiry
      |
    Application
      |
    Applicant
      |
    Enrolled Student

Track:

- Source
- Contact information
- Program interest
- Status
- Assigned admissions officer
- Notes
- Follow-ups
- Conversion

---

# 24. NOTIFICATIONS

Create a centralized notification system.

Channels:

- In-app
- Email
- Push notification
- SMS (future/optional)

Events:

- Application received
- Enrollment approved
- Payment received
- Payment overdue
- Class reminder
- Schedule change
- Exam announcement
- Result released
- New learning material
- Certificate issued
- Account security event

Do not hard-code notification logic throughout individual modules.

Use a centralized event/notification architecture.

---

# 25. APPROVAL WORKFLOWS

Sensitive operations should support approval workflows.

Examples:

    Exam Draft
       |
    Instructor
       |
    Academic Reviewer
       |
    Academic Director
       |
    Published

Finance:

    Refund Request
       |
    Finance Officer
       |
    Finance Manager
       |
    Approved
       |
    Processed

Enrollment:

    Application
       |
    Admissions
       |
    Requirements Verified
       |
    Payment Verified
       |
    Enrollment Approved

---

# 26. AUDIT LOGGING

Create immutable audit records for sensitive operations.

Audit information should include:

- Actor
- Action
- Resource
- Resource ID
- Timestamp
- IP address
- User agent/device where appropriate
- Before state
- After state
- Reason where applicable

Audit:

- Login/security events
- User changes
- Role changes
- Permission changes
- Student changes
- Grade changes
- Exam changes
- Payment changes
- Refunds
- Enrollment changes
- Published content
- Configuration changes

Normal users must not be able to modify audit history.

---

# 27. SECURITY

Treat security as a core architectural requirement.

Implement:

- Secure authentication
- Strong password hashing
- Session management
- Refresh token rotation where applicable
- MFA for privileged accounts
- Rate limiting
- Input validation
- Backend authorization
- Object-level authorization
- Secure file access
- Encryption in transit
- Encryption at rest where appropriate
- Secure secrets management
- Audit logging
- Backup and disaster recovery
- Security monitoring

Never trust frontend authorization.

The backend must independently authorize every protected operation.

---

# 28. MOBILE-FIRST UX

The student experience should be designed mobile-first.

Suggested bottom navigation:

    Home
    Learn
    Exams
    Schedule
    Profile

The administrative interface can use a desktop sidebar:

    Dashboard
    Students
    Admissions
    Enrollment
    Programs
    Courses
    Classes
    Schedule
    Attendance
    Exams
    Content
    Finance
    Reports
    Staff
    Settings
    Audit Logs

The mobile application should not simply be a compressed desktop dashboard.

Design workflows specifically for mobile interaction.

---

# 29. DESIGN SYSTEM

Create a reusable design system.

Components:

- Buttons
- Inputs
- Selects
- Forms
- Cards
- Tables
- Tabs
- Modals
- Drawers
- Dropdowns
- Badges
- Alerts
- Toasts
- Progress indicators
- Charts
- Calendar
- File uploader
- Pagination
- Empty states
- Loading states
- Error states

Define:

- Color tokens
- Typography
- Spacing
- Radius
- Shadows
- Breakpoints
- Icons
- Interaction states

The visual identity should be based on the organization's existing branding while modernizing it for a digital product.

---

# 30. RECOMMENDED TECHNOLOGY

Unless there is a strong technical reason to choose otherwise, consider:

## Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- Accessible component system
- TanStack Query
- React Hook Form
- Zod

## Backend

- NestJS
- TypeScript
- REST API

## Database

- PostgreSQL

## Infrastructure

- Redis
- Object storage
- Background workers
- Email service
- Push notification service

Use an architecture that allows replacement of infrastructure providers without rewriting the domain layer.

---

# 31. BACKEND MODULES

Organize the backend into domain modules:

    auth/
    identity/
    users/
    roles/
    permissions/
    organizations/
    branches/

    students/
    instructors/
    staff/

    admissions/
    enrollments/
    programs/
    courses/
    subjects/
    lessons/
    materials/

    question-bank/
    exams/
    assessments/
    grades/
    progress/

    classes/
    schedules/
    rooms/
    attendance/

    billing/
    payments/
    refunds/

    notifications/
    certificates/
    reports/
    audit/

    settings/

Keep domain boundaries clear.

---

# 32. DATABASE PRINCIPLES

Use a relational database.

Primary candidate:

**PostgreSQL**

Model relationships explicitly.

Do not denormalize prematurely.

Use:

- Foreign keys
- Constraints
- Unique indexes
- Composite indexes where appropriate
- Soft deletion where appropriate
- Audit history for sensitive records
- Transaction boundaries
- Database-level integrity constraints

Do not rely exclusively on application code for data integrity.

---

# 33. API DESIGN

Use a versioned API.

Example:

    /api/v1/users
    /api/v1/students
    /api/v1/programs
    /api/v1/courses
    /api/v1/classes
    /api/v1/schedules
    /api/v1/enrollments
    /api/v1/questions
    /api/v1/exams
    /api/v1/results
    /api/v1/payments
    /api/v1/reports

Keep APIs predictable and resource-oriented.

---

# 34. TESTING

Plan testing from the beginning.

Include:

### Unit tests

Business logic.

### Integration tests

Database and service interactions.

### API tests

Authorization and endpoint behavior.

### End-to-end tests

Critical workflows.

At minimum test:

    Registration
    Login
    Enrollment
    Payment
    Class assignment
    Attendance
    Quiz
    Exam
    Grading
    Results
    Permission enforcement
    Audit logging

Authorization tests are especially important.

---

# 35. OBSERVABILITY

Production system should support:

- Structured logs
- Error tracking
- Metrics
- Performance monitoring
- Background job monitoring
- Security event monitoring
- Database monitoring

Sensitive information should not be written into logs unnecessarily.

---

# 36. MVP STRATEGY

Do not attempt to build every feature simultaneously.

## Phase 1 — Foundation

- Authentication
- Users
- Roles
- Permissions
- Organizations
- Branches
- Audit logs
- Design system

## Phase 2 — Core Operations

- Students
- Programs
- Courses
- Classes
- Schedules
- Enrollment
- Instructors
- Attendance

## Phase 3 — Learning

- Lessons
- Materials
- Question bank
- Quizzes
- Exams
- Grading
- Results
- Progress

## Phase 4 — Finance

- Pricing
- Invoices
- Payments
- Receipts
- Discounts
- Refunds

## Phase 5 — Advanced Management

- Analytics
- Reports
- Workflows
- Notifications
- Certificates
- CRM

## Phase 6 — Mobile / Advanced Features

- PWA enhancements
- Push notifications
- Optional native application
- Advanced analytics
- Personalized learning

---

# 37. DO NOT MAKE THESE ARCHITECTURAL MISTAKES

Avoid:

- Hard-coded roles
- Hard-coded programs
- Hard-coded branches
- Frontend-only authorization
- One giant admin dashboard
- One giant database model
- Storing files in the database
- Mixing authentication and domain profiles
- Building separate authentication systems for each user type
- Tight coupling between modules
- Premature microservices
- Building a native mobile app before validating the web/PWA experience
- Building every feature before validating enrollment and learning workflows

Start modular and well-structured.

Do not introduce microservices merely for the sake of appearing scalable.

---

# 38. REQUIRED DELIVERABLE

Before writing production code, produce a complete technical and product blueprint.

Include:

1. Product overview
2. User personas
3. User journeys
4. Feature map
5. Sitemap
6. Application information architecture
7. Student UX
8. Instructor UX
9. Admin UX
10. Finance UX
11. Registrar UX
12. Admissions UX
13. Role hierarchy
14. Complete RBAC matrix
15. Permission model
16. Permission scopes
17. Organization model
18. Branch model
19. Database ERD
20. Entity definitions
21. API architecture
22. Backend module architecture
23. Frontend architecture
24. Design system
25. Responsive strategy
26. Security architecture
27. Audit architecture
28. Notification architecture
29. Workflow architecture
30. Enrollment workflow
31. Payment workflow
32. Learning workflow
33. Exam workflow
34. Reporting architecture
35. Testing strategy
36. Deployment architecture
37. Backup strategy
38. MVP scope
39. Phase 2 scope
40. Phase 3 scope
41. Development roadmap
42. Technical risks
43. Product risks
44. Recommended mitigations

---

# 39. IMPORTANT WORKING RULES

Do not jump immediately into writing code.

First understand the business domain.

When requirements are ambiguous:

1. Identify the ambiguity.
2. State the assumption.
3. Explain the architectural consequence.
4. Recommend a solution.
5. Continue with the design.

Do not silently make major architectural decisions.

Favor simple, maintainable solutions over unnecessary complexity.

When proposing technology, explain why it fits this project.

When proposing a feature, identify:

- Users
- Permissions
- Data
- Workflow
- UI
- API
- Security implications

Always consider mobile and desktop behavior.

Always consider authorization.

Always consider auditability.

Always consider future multi-branch operation.

---

# 40. FINAL OBJECTIVE

The final product should allow OBIAS to manage the complete lifecycle:

    Marketing
        ↓
    Inquiry
        ↓
    Application
        ↓
    Enrollment
        ↓
    Payment
        ↓
    Class Assignment
        ↓
    Attendance
        ↓
    Learning
        ↓
    Practice
        ↓
    Mock Exams
        ↓
    Assessment
        ↓
    Results
        ↓
    Completion
        ↓
    Certificate
        ↓
    Alumni / Future Programs

All of this should be managed through one secure, scalable platform.

The system should feel like a modern healthcare education platform rather than a generic school management system.

Do not optimize for the largest possible feature count.

Optimize for:

- Correct architecture
- Excellent UX
- Security
- Maintainability
- Operational efficiency
- Mobile usability
- Scalability
- Clear permissions
- Reliable data
- Excellent student experience