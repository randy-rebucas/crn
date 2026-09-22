import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { buildEffectivePermissions } from './permission.utils.js';
import type { AuthenticatedUser } from './auth.types.js';

interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async issueTokens(userId: string, organizationId: string, email: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, organizationId, email },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '15m') as `${number}${'s' | 'm' | 'h' | 'd'}`,
      },
    );

    const refreshToken = randomBytes(48).toString('hex');
    const ttlMs = this.parseTtlMs(this.config.get<string>('JWT_REFRESH_TTL', '7d'));

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });

    return { accessToken, refreshToken };
  }

  private parseTtlMs(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const value = Number(match[1]);
    const unit = match[2];
    const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit] ?? 86_400_000;
    return value * unitMs;
  }

  async login(email: string, password: string, ctx: RequestContext) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        branches: true,
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });

    const passwordValid = user ? await argon2.verify(user.passwordHash, password) : false;

    if (!user || !passwordValid || user.status !== 'ACTIVE') {
      // An unknown-email attempt has no organization to attribute it to —
      // email is globally unique across the whole platform, so this event
      // happens before we know which (if any) tenant it concerns. Audit
      // rows are now always organization-scoped (see the AuditLog schema
      // comment), so this case is intentionally not written to the
      // per-tenant audit trail; only a known account's failed attempt is.
      if (user) {
        await this.audit.log({
          organizationId: user.organizationId,
          action: 'auth.login.failed',
          resource: 'user',
          resourceId: user.id,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          reason: !passwordValid ? 'bad_password' : 'inactive_account',
        });
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueTokens(user.id, user.organizationId, user.email);

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    await this.audit.log({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'auth.login.success',
      resource: 'user',
      resourceId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    const authUser: AuthenticatedUser = {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      branchIds: user.branches.map((b) => b.branchId),
      roles: user.roles.map((r) => r.role.key),
      permissions: buildEffectivePermissions(user.roles),
    };

    return { ...tokens, user: authUser };
  }

  async refresh(refreshToken: string, ctx: RequestContext) {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date() || stored.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Rotate: revoke the used token and issue a new pair.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokens(stored.user.id, stored.user.organizationId, stored.user.email);

    await this.audit.log({
      organizationId: stored.user.organizationId,
      actorId: stored.user.id,
      action: 'auth.token.refreshed',
      resource: 'user',
      resourceId: stored.user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return tokens;
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
