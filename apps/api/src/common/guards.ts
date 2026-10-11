import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { can, MFA_REQUIRED_ROLES, type Permission, type Role } from '@sufra/shared';
import { allowedOrigins, config } from '../config';
import { IS_PUBLIC, PERMS, SKIP_MFA_ENROLLMENT } from './decorators';
import { requestContext } from './tenant-context';
import { DbService } from './prisma.service';

export const ACCESS_COOKIE = 'sufra_at';
export const REFRESH_COOKIE = 'sufra_rt';
export const SESSION_HINT_COOKIE = 'sufra_session';

export interface AccessClaims {
  sub: string;
  org: string;
  br: string;
  roles: Role[];
  mfa: boolean; // user has MFA enabled
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence for cookie-authenticated requests: state-changing requests must come from an allowed origin.
 * Cookies are also SameSite=Lax + httpOnly.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;
    const hasCookie = Boolean(req.cookies?.[ACCESS_COOKIE] || req.cookies?.[REFRESH_COOKIE]);
    if (!hasCookie) return true;
    const origin = req.headers.origin ?? (req.headers.referer ? new URL(req.headers.referer).origin : undefined);
    if (origin && allowedOrigins().includes(origin)) return true;
    throw new ForbiddenException('origin_not_allowed');
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly db: DbService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;
    const token = req.cookies?.[ACCESS_COOKIE] ?? (header?.startsWith('Bearer ') ? header.slice(7) : undefined);
    if (!token) throw new UnauthorizedException('not_authenticated');

    let claims: AccessClaims;
    try {
      claims = await this.jwt.verifyAsync<AccessClaims>(token, { secret: config().JWT_ACCESS_SECRET, algorithms: ['HS256'] });
    } catch {
      throw new UnauthorizedException('token_invalid');
    }

    const store = requestContext.getStore();
    if (!store) throw new UnauthorizedException();
    store.orgId = claims.org;
    store.userId = claims.sub;
    store.roles = claims.roles;
    store.branchId = claims.br;

    // Optional branch switch; RLS guarantees the branch belongs to the caller's organization.
    const requested = req.headers['x-branch-id'];
    if (typeof requested === 'string' && requested !== claims.br) {
      if (!/^[0-9a-f-]{36}$/i.test(requested)) throw new ForbiddenException('branch_invalid');
      const branch = await this.db.client.branch.findUnique({ where: { id: requested }, select: { id: true } });
      if (!branch) throw new ForbiddenException('branch_forbidden');
      store.branchId = branch.id;
    }

    const skipMfa = this.reflector.getAllAndOverride<boolean>(SKIP_MFA_ENROLLMENT, [context.getHandler(), context.getClass()]);
    if (config().MFA_ENFORCE && !skipMfa && !claims.mfa && claims.roles.some((r) => MFA_REQUIRED_ROLES.includes(r))) {
      throw new ForbiddenException('mfa_enrollment_required');
    }
    return true;
  }
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMS, [context.getHandler(), context.getClass()]);
    if (!required?.length) return true;
    const roles = requestContext.getStore()?.roles ?? [];
    if (required.every((p) => can(roles, p))) return true;
    throw new ForbiddenException('permission_denied');
  }
}
