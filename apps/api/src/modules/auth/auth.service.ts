import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { randomUUID } from 'node:crypto';
import { MFA_REQUIRED_ROLES, type Role } from '@sufra/shared';
import { config } from '../../config';
import { CryptoService } from '../../common/crypto.service';
import { SystemDbService } from '../../common/prisma.service';
import type { AccessClaims } from '../../common/guards';

const ACCESS_TTL_SEC = 15 * 60;
export const REFRESH_TTL_SEC = 7 * 24 * 60 * 60;
const MFA_CHALLENGE_TTL_SEC = 5 * 60;
const MAX_FAILED = 5;
const LOCK_MIN = 15;
// Pre-computed hash used when the e-mail is unknown, so response time does not reveal which accounts exist.
const DUMMY_HASH = '$argon2id$v=19$m=19456,p=1,t=2$GRDjyLXUEbcv13UVq5IIXA$CkfZ+EbgdnzEf5ZYKbhWTPlp2sJTKZNOMp19/3a/eRA';

authenticator.options = { window: 1 };

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly sys: SystemDbService,
    private readonly jwt: JwtService,
    private readonly crypto: CryptoService,
  ) {}

  static hashPassword(pw: string) {
    return argon2.hash(pw, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  }

  async login(email: string, password: string, meta: { ip?: string; ua?: string }) {
    const user = await this.sys.user.findUnique({ where: { email }, include: { roles: true } });
    if (!user || !user.active) {
      await argon2.verify(DUMMY_HASH, password).catch(() => false);
      throw new UnauthorizedException('invalid_credentials');
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) throw new ForbiddenException('account_locked');

    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) {
      const failed = user.failedLogins + 1;
      await this.sys.user.update({
        where: { id: user.id },
        data: failed >= MAX_FAILED ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MIN * 60_000) } : { failedLogins: failed },
      });
      throw new UnauthorizedException('invalid_credentials');
    }
    await this.sys.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });

    if (user.mfaEnabled) {
      const challenge = await this.jwt.signAsync(
        { sub: user.id, typ: 'mfa' },
        { secret: config().JWT_ACCESS_SECRET, expiresIn: MFA_CHALLENGE_TTL_SEC, algorithm: 'HS256' },
      );
      return { mfaRequired: true as const, challenge };
    }
    return { mfaRequired: false as const, tokens: await this.issue(user.id, meta) };
  }

  async verifyMfa(challenge: string, code: string, meta: { ip?: string; ua?: string }) {
    let payload: { sub: string; typ: string };
    try {
      payload = await this.jwt.verifyAsync(challenge, { secret: config().JWT_ACCESS_SECRET, algorithms: ['HS256'] });
    } catch {
      throw new UnauthorizedException('challenge_invalid');
    }
    if (payload.typ !== 'mfa') throw new UnauthorizedException('challenge_invalid');
    const user = await this.sys.user.findUniqueOrThrow({ where: { id: payload.sub } });
    if (!user.mfaSecretEnc || !authenticator.check(code, this.crypto.decrypt(user.mfaSecretEnc))) {
      throw new UnauthorizedException('mfa_invalid');
    }
    return this.issue(user.id, meta);
  }

  /** Issues an access token and a new refresh-token family. */
  async issue(userId: string, meta: { ip?: string; ua?: string }, family: string = randomUUID()): Promise<IssuedTokens> {
    const user = await this.sys.user.findUniqueOrThrow({ where: { id: userId }, include: { roles: true } });
    const branch = await this.sys.branch.findFirstOrThrow({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'asc' },
    });
    const claims: AccessClaims = {
      sub: user.id,
      org: user.organizationId,
      br: branch.id,
      roles: [...new Set(user.roles.map((r) => r.role as Role))],
      mfa: user.mfaEnabled,
    };
    const accessToken = await this.jwt.signAsync(claims, {
      secret: config().JWT_ACCESS_SECRET,
      expiresIn: ACCESS_TTL_SEC,
      algorithm: 'HS256',
    });
    const refreshToken = CryptoService.token(48);
    await this.sys.session.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        family,
        tokenHash: CryptoService.sha256(refreshToken),
        ip: meta.ip?.slice(0, 64),
        userAgent: meta.ua?.slice(0, 255),
        expiresAt: new Date(Date.now() + REFRESH_TTL_SEC * 1000),
      },
    });
    return { accessToken, refreshToken };
  }

  /** Rotates the refresh token. Reuse of an already-rotated token revokes the whole family. */
  async refresh(refreshToken: string, meta: { ip?: string; ua?: string }): Promise<IssuedTokens> {
    const session = await this.sys.session.findUnique({ where: { tokenHash: CryptoService.sha256(refreshToken) } });
    if (!session) throw new UnauthorizedException('refresh_invalid');
    if (session.revokedAt) {
      await this.sys.session.updateMany({ where: { family: session.family, revokedAt: null }, data: { revokedAt: new Date() } });
      throw new UnauthorizedException('refresh_reused');
    }
    if (session.expiresAt < new Date()) throw new UnauthorizedException('refresh_expired');
    const user = await this.sys.user.findUnique({ where: { id: session.userId } });
    if (!user?.active) throw new UnauthorizedException('refresh_invalid');
    await this.sys.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return this.issue(session.userId, meta, session.family);
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return;
    const session = await this.sys.session.findUnique({ where: { tokenHash: CryptoService.sha256(refreshToken) } });
    if (session) await this.sys.session.updateMany({ where: { family: session.family }, data: { revokedAt: new Date() } });
  }

  async setupMfa(userId: string) {
    const user = await this.sys.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.mfaEnabled) throw new ForbiddenException('mfa_already_enabled');
    const secret = authenticator.generateSecret(20);
    await this.sys.user.update({ where: { id: userId }, data: { mfaSecretEnc: this.crypto.encrypt(secret) } });
    const otpauthUrl = authenticator.keyuri(user.email, 'Sufra', secret);
    return { otpauthUrl, qrDataUrl: await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 }) };
  }

  async enableMfa(userId: string, code: string) {
    const user = await this.sys.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.mfaSecretEnc || !authenticator.check(code, this.crypto.decrypt(user.mfaSecretEnc))) {
      throw new UnauthorizedException('mfa_invalid');
    }
    await this.sys.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
  }

  async disableMfa(userId: string, code: string, roles: Role[]) {
    if (config().MFA_ENFORCE && roles.some((r) => MFA_REQUIRED_ROLES.includes(r))) throw new ForbiddenException('mfa_required_for_role');
    const user = await this.sys.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.mfaEnabled || !user.mfaSecretEnc || !authenticator.check(code, this.crypto.decrypt(user.mfaSecretEnc))) {
      throw new UnauthorizedException('mfa_invalid');
    }
    await this.sys.user.update({ where: { id: userId }, data: { mfaEnabled: false, mfaSecretEnc: null } });
  }
}
