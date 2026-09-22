import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CertificatesService } from './certificates.service.js';
import { IssueCertificateDto } from './dto/issue-certificate.dto.js';

@Controller('v1/certificates')
export class CertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  // Public: no guard. Anyone with the QR token/link can confirm a
  // certificate is genuine without needing an OBIAS account.
  @Get('verify/:qrToken')
  verify(@Param('qrToken') qrToken: string) {
    return this.certificates.verify(qrToken);
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('certificates.view')
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.certificates.findAllForOrganization(user.organizationId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('certificates.issue')
  issue(@CurrentUser() user: AuthenticatedUser, @Body() dto: IssueCertificateDto) {
    return this.certificates.issue(user.organizationId, user.id, dto);
  }
}
