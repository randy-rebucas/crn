import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { RolesModule } from './modules/roles/roles.module.js';
import { PermissionsModule } from './modules/permissions/permissions.module.js';
import { OrganizationsModule } from './modules/organizations/organizations.module.js';
import { BranchesModule } from './modules/branches/branches.module.js';
import { ProgramsModule } from './modules/programs/programs.module.js';
import { CoursesModule } from './modules/courses/courses.module.js';
import { StudentsModule } from './modules/students/students.module.js';
import { InstructorsModule } from './modules/instructors/instructors.module.js';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module.js';
import { BatchesModule } from './modules/batches/batches.module.js';
import { RoomsModule } from './modules/rooms/rooms.module.js';
import { ClassesModule } from './modules/classes/classes.module.js';
import { SchedulesModule } from './modules/schedules/schedules.module.js';
import { AttendanceModule } from './modules/attendance/attendance.module.js';
import { SubjectsModule } from './modules/subjects/subjects.module.js';
import { CurriculumModule } from './modules/curriculum/curriculum.module.js';
import { QuestionsModule } from './modules/questions/questions.module.js';
import { ExamsModule } from './modules/exams/exams.module.js';
import { AttemptsModule } from './modules/attempts/attempts.module.js';
import { PricingModule } from './modules/pricing/pricing.module.js';
import { InvoicesModule } from './modules/invoices/invoices.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { RefundsModule } from './modules/refunds/refunds.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { CertificatesModule } from './modules/certificates/certificates.module.js';
import { LeadsModule } from './modules/leads/leads.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { ProgressModule } from './modules/progress/progress.module.js';
import { GradesModule } from './modules/grades/grades.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { AdmissionsModule } from './modules/admissions/admissions.module.js';
import { StaffModule } from './modules/staff/staff.module.js';
import { RequirementsModule } from './modules/requirements/requirements.module.js';
import { PublicModule } from './modules/public/public.module.js';
import { ContentModule } from './modules/content/content.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    OrganizationsModule,
    BranchesModule,
    ProgramsModule,
    CoursesModule,
    StudentsModule,
    InstructorsModule,
    EnrollmentsModule,
    BatchesModule,
    RoomsModule,
    ClassesModule,
    SchedulesModule,
    AttendanceModule,
    SubjectsModule,
    CurriculumModule,
    QuestionsModule,
    ExamsModule,
    AttemptsModule,
    PricingModule,
    InvoicesModule,
    PaymentsModule,
    RefundsModule,
    NotificationsModule,
    CertificatesModule,
    LeadsModule,
    ReportsModule,
    ProgressModule,
    GradesModule,
    SettingsModule,
    AdmissionsModule,
    StaffModule,
    RequirementsModule,
    PublicModule,
    ContentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
