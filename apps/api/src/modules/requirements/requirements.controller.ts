import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { RequirementsService } from './requirements.service.js';
import { CreateRequirementDto } from './dto/create-requirement.dto.js';
import { ReviewSubmissionDto } from './dto/review-submission.dto.js';
import {
  REQUIREMENT_FILE_ALLOWED_MIME_TYPES,
  REQUIREMENT_FILE_MAX_BYTES,
  requirementFileStorage,
} from './file-storage.js';

@Controller('v1')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RequirementsController {
  constructor(private readonly requirements: RequirementsService) {}

  @Get('requirements')
  @RequirePermissions('requirements.view')
  listTemplates(@CurrentUser() user: AuthenticatedUser, @Query('programId') programId?: string) {
    return this.requirements.listTemplates(user.organizationId, programId);
  }

  @Post('requirements')
  @RequirePermissions('requirements.manage')
  createTemplate(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRequirementDto) {
    return this.requirements.createTemplate(user.organizationId, user.id, dto);
  }

  @Get('enrollments/:enrollmentId/requirements')
  @RequirePermissions('requirements.view')
  listForEnrollment(@CurrentUser() user: AuthenticatedUser, @Param('enrollmentId') enrollmentId: string) {
    return this.requirements.listForEnrollment(user, enrollmentId);
  }

  @Post('enrollments/:enrollmentId/requirements/:requirementId/submit')
  @RequirePermissions('requirements.submit')
  @UseInterceptors(
    FileInterceptor('file', { storage: requirementFileStorage, limits: { fileSize: REQUIREMENT_FILE_MAX_BYTES } }),
  )
  async submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('enrollmentId') enrollmentId: string,
    @Param('requirementId') requirementId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('A file is required');
    if (!REQUIREMENT_FILE_ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type "${file.mimetype}". Allowed: ${[...REQUIREMENT_FILE_ALLOWED_MIME_TYPES].join(', ')}`,
      );
    }
    return this.requirements.submitFile(user, enrollmentId, requirementId, file);
  }

  @Patch('requirement-submissions/:id/review')
  @RequirePermissions('requirements.review')
  review(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewSubmissionDto,
  ) {
    return this.requirements.review(user, id, dto);
  }

  @Get('requirement-submissions/:id/file')
  @RequirePermissions('requirements.view')
  async downloadFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const submission = await this.requirements.getFileForDownload(user, id);
    res.download(submission.filePath as string, submission.fileName ?? 'download');
  }
}
