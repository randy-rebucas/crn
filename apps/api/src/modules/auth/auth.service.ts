import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
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
        algorithm: 'HS256',
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
      firstName: user.firstName,
      lastName: user.lastName,
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

    // A replay of a token that was already rotated out (revoked but not yet
    // expired) is a compromise signal: a legitimate client never reuses a
    // refresh token after it rotates. Whether the replay is the thief or the
    // rightful owner racing them, we can't tell which — so kill every
    // session for this account rather than just rejecting the one request.
    if (stored?.revokedAt && stored.expiresAt >= new Date()) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.log({
        organizationId: stored.user.organizationId,
        actorId: stored.userId,
        action: 'auth.refresh_token.reuse_detected',
        resource: 'user',
        resourceId: stored.userId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!stored || stored.expiresAt < new Date() || stored.user.status !== 'ACTIVE') {
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

  // Always resolves the same way regardless of whether the email exists —
  // an anonymous caller must never be able to tell known accounts from
  // unknown ones via this endpoint (user enumeration).
  //
  // No email transport is wired up in this codebase yet, so the reset link
  // is logged to the server console instead of sent — this is a real,
  // working token flow, just missing the delivery channel. Wire an actual
  // mail provider into the `// TODO` below before relying on this in
  // production.
  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== 'ACTIVE') return;

    const token = randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const webOrigin = this.config.get<string>('WEB_ORIGIN', 'http://localhost:3000');
    // TODO: send via a real mail provider instead of logging.
    // The raw token is only ever logged outside production: application logs
    // are frequently aggregated somewhere less trusted than the DB, and a
    // logged token is a live account-takeover credential until it expires.
    if (this.config.get<string>('NODE_ENV') !== 'production') {
      // eslint-disable-next-line no-console
      console.log(`[password-reset] ${email}: ${webOrigin}/reset-password?token=${token}`);
    } else {
      // eslint-disable-next-line no-console
      console.warn(`[password-reset] requested for ${email}, but no mail provider is configured`);
    }

    await this.audit.log({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'auth.password_reset.requested',
      resource: 'user',
      resourceId: user.id,
    });
  }

  // Signed-in password change. Requires the current password even though the
  // caller holds a valid access token — a borrowed unlocked device shouldn't
  // be enough to take the account over. Every other session is revoked;
  // `keepRefreshToken` (the caller's own) is spared so they stay signed in.
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    keepRefreshToken: string | undefined,
    ctx: RequestContext,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException();

    if (!(await argon2.verify(user.passwordHash, currentPassword))) {
      await this.audit.log({
        organizationId: user.organizationId,
        actorId: user.id,
        action: 'auth.password_change.failed',
        resource: 'user',
        resourceId: user.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        reason: 'bad_password',
      });
      throw new BadRequestException('Your current password is incorrect');
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException('Choose a password different from your current one');
    }

    const passwordHash = await argon2.hash(newPassword);
    const keepHash = keepRefreshToken ? this.hashToken(keepRefreshToken) : undefined;

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null, ...(keepHash ? { tokenHash: { not: keepHash } } : {}) },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.audit.log({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'auth.password_change.completed',
      resource: 'user',
      resourceId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = this.hashToken(token);
    const stored = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.usedAt || stored.expiresAt < new Date() || stored.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid or expired reset link');
    }

    const passwordHash = await argon2.hash(newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: stored.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({ where: { id: stored.id }, data: { usedAt: new Date() } }),
      // A password reset invalidates every existing session, not just this flow's own token.
      this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.audit.log({
      organizationId: stored.user.organizationId,
      actorId: stored.userId,
      action: 'auth.password_reset.completed',
      resource: 'user',
      resourceId: stored.userId,
    });
  }
}
