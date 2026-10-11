import { Body, Controller, Get, HttpCode, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { loginSchema, mfaSchema } from '@sufra/shared';
import { config } from '../../config';
import { AllowWithoutMfa, Public } from '../../common/decorators';
import { ACCESS_COOKIE, REFRESH_COOKIE, SESSION_HINT_COOKIE } from '../../common/guards';
import { ZodPipe } from '../../common/zod.pipe';
import { ctx } from '../../common/tenant-context';
import { AuditService } from '../../common/audit.service';
import { AuthService, IssuedTokens, REFRESH_TTL_SEC } from './auth.service';
import { MeService } from './me.service';

/** Login attempts per minute per client IP (raised only in automated tests). */
const LOGIN_LIMIT = Number(process.env.LOGIN_RATE_LIMIT ?? 5);

const codeSchema = z.object({ code: z.string().regex(/^\d{6}$/) });

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly me: MeService,
    private readonly audit: AuditService,
  ) {}

  private meta(req: Request) {
    return { ip: req.ip, ua: req.headers['user-agent'] };
  }

  private setCookies(res: Response, t: IssuedTokens) {
    const secure = config().COOKIE_SECURE;
    res.cookie(ACCESS_COOKIE, t.accessToken, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 15 * 60 * 1000 });
    res.cookie(REFRESH_COOKIE, t.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      path: `${config().COOKIE_PATH_PREFIX}/v1/auth`,
      maxAge: REFRESH_TTL_SEC * 1000,
    });
    // Non-secret hint so the web app's edge middleware knows a session may exist (the refresh cookie is path-scoped).
    res.cookie(SESSION_HINT_COOKIE, '1', { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: REFRESH_TTL_SEC * 1000 });
  }

  private clearCookies(res: Response) {
    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_COOKIE, { path: `${config().COOKIE_PATH_PREFIX}/v1/auth` });
    res.clearCookie(SESSION_HINT_COOKIE, { path: '/' });
  }

  @Public()
  @Throttle({ default: { limit: LOGIN_LIMIT, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body(new ZodPipe(loginSchema)) body: z.infer<typeof loginSchema>, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(body.email, body.password, this.meta(req));
    if (result.mfaRequired) return { mfaRequired: true, challenge: result.challenge };
    this.setCookies(res, result.tokens);
    return { mfaRequired: false };
  }

  @Public()
  @Throttle({ default: { limit: LOGIN_LIMIT, ttl: 60_000 } })
  @Post('mfa')
  @HttpCode(200)
  async mfa(@Body(new ZodPipe(mfaSchema)) body: z.infer<typeof mfaSchema>, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.setCookies(res, await this.auth.verifyMfa(body.challenge, body.code, this.meta(req)));
    return { ok: true };
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException('refresh_missing');
    try {
      this.setCookies(res, await this.auth.refresh(token, this.meta(req)));
    } catch (e) {
      this.clearCookies(res);
      throw e;
    }
    return { ok: true };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    this.clearCookies(res);
    return { ok: true };
  }

  @AllowWithoutMfa()
  @Get('me')
  getMe() {
    return this.me.get();
  }

  @AllowWithoutMfa()
  @Post('mfa/setup')
  @HttpCode(200)
  setupMfa() {
    return this.auth.setupMfa(ctx().userId!);
  }

  @AllowWithoutMfa()
  @Post('mfa/enable')
  @HttpCode(200)
  async enableMfa(@Body(new ZodPipe(codeSchema)) body: { code: string }) {
    await this.auth.enableMfa(ctx().userId!, body.code);
    await this.audit.log('mfa.enable', 'user', ctx().userId!);
    return { ok: true };
  }

  @Post('mfa/disable')
  @HttpCode(200)
  async disableMfa(@Body(new ZodPipe(codeSchema)) body: { code: string }) {
    await this.auth.disableMfa(ctx().userId!, body.code, ctx().roles ?? []);
    await this.audit.log('mfa.disable', 'user', ctx().userId!);
    return { ok: true };
  }
}
