import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { PublicService } from './public.service.js';
import { CreatePublicLeadDto } from './dto/create-public-lead.dto.js';
import { RegisterStudentDto } from './dto/register-student.dto.js';

// Deliberately no JwtAuthGuard/PermissionsGuard here — this is the only
// surface anonymous website visitors can reach. Every handler must stay
// narrow: write-only lead capture, or reads that are already filtered to
// PUBLISHED/active rows in the service layer — never a passthrough to
// tenant-internal data.
@Controller('v1/public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('programs')
  findPrograms() {
    return this.publicService.findPublishedPrograms();
  }

  @Get('programs/:slug')
  findProgram(@Param('slug') slug: string) {
    return this.publicService.findPublishedProgramBySlug(slug);
  }

  @Get('branches')
  findBranches() {
    return this.publicService.findActiveBranches();
  }

  @Get('instructors')
  findInstructors() {
    return this.publicService.findInstructors();
  }

  @Get('instructors/:id')
  findInstructor(@Param('id') id: string) {
    return this.publicService.findInstructor(id);
  }

  @Get('schedule')
  findSchedule() {
    return this.publicService.findUpcomingSchedule();
  }

  @Get('announcements')
  findAnnouncements() {
    return this.publicService.findAnnouncements();
  }

  @Get('announcements/:id')
  findAnnouncement(@Param('id') id: string) {
    return this.publicService.findAnnouncement(id);
  }

  @Get('success-stories')
  findSuccessStories() {
    return this.publicService.findSuccessStories();
  }

  @Get('faq')
  findFaqItems() {
    return this.publicService.findFaqItems();
  }

  @Post('leads')
  createLead(@Body() dto: CreatePublicLeadDto) {
    return this.publicService.createLead(dto);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterStudentDto) {
    return this.publicService.registerStudent(dto);
  }
}
