import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service.js';
import { buildEffectivePermissions } from '../../modules/auth/permission.utils.js';
import type { AuthenticatedUser, JwtAccessPayload } from '../../modules/auth/auth.types.js';

/**
 * Verifies the bearer access token and attaches the resolved AuthenticatedUser
 * to the request. Implemented directly against @nestjs/jwt rather than
 * @nestjs/passport: passport's AuthGuard mixin needs its AuthModuleOptions
 * provider present in every module that uses the guard, which turns into
 * DI wiring busywork across a large module tree for no real benefit here.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let payload: JwtAccessPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtAccessPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        branches: true,
        roles: {
          include: { role: { include: { permissions: { include: { permission: true } } } } },
        },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      branchIds: user.branches.map((b) => b.branchId),
      roles: user.roles.map((r) => r.role.key),
      permissions: buildEffectivePermissions(user.roles),
    };

    request.user = authenticatedUser;
    return true;
  }

  private extractToken(request: { headers: Record<string, string | undefined> }): string | undefined {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return undefined;
    return header.slice('Bearer '.length);
  }
}
