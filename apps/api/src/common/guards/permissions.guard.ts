import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator.js';
import type { AuthenticatedUser } from '../../modules/auth/auth.types.js';

/**
 * Confirms the authenticated user holds every required permission key
 * (any scope). This only proves the user MAY perform the action in principle;
 * each service must still narrow queries/mutations to the user's actual
 * scope (self/assigned/branch/organization/global) before touching data.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const heldKeys = new Set(user.permissions.map((p) => p.key));
    const hasAll = required.every((key) => heldKeys.has(key));

    if (!hasAll) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
