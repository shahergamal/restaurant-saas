import { Injectable } from '@nestjs/common';
import { permissionsFor, type Role } from '@sufra/shared';
import { DbService } from '../../common/prisma.service';
import { ctx } from '../../common/tenant-context';

@Injectable()
export class MeService {
  constructor(private readonly db: DbService) {}

  async get() {
    const c = ctx();
    const [user, org, branches] = await Promise.all([
      this.db.client.user.findUniqueOrThrow({
        where: { id: c.userId! },
        select: { id: true, nameAr: true, nameEn: true, email: true, mfaEnabled: true, locale: true, numerals: true },
      }),
      this.db.client.organization.findUniqueOrThrow({ where: { id: c.orgId! }, select: { id: true, nameAr: true, nameEn: true, plan: true } }),
      this.db.client.branch.findMany({ select: { id: true, nameAr: true, nameEn: true }, orderBy: { createdAt: 'asc' } }),
    ]);
    const roles = (c.roles ?? []) as Role[];
    return {
      user,
      organization: org,
      branches,
      branchId: c.branchId,
      roles,
      permissions: [...permissionsFor(roles)],
    };
  }
}
