import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DbService, TxClient } from './prisma.service';
import { ctx } from './tenant-context';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  constructor(private readonly db: DbService) {}

  /** Records a financial or security-relevant action. Pass `tx` to make the entry atomic with the change. */
  async log(action: string, entity: string, entityId: string | null, diff?: unknown, tx?: TxClient) {
    const c = ctx();
    const data = {
      organizationId: c.orgId!,
      userId: c.userId ?? null,
      action,
      entity,
      entityId,
      diff: (diff ?? undefined) as Prisma.InputJsonValue | undefined,
      ip: c.ip ?? null,
    };
    try {
      if (tx) await tx.auditLog.create({ data });
      else await this.db.client.auditLog.create({ data });
    } catch (e) {
      this.logger.error(`audit write failed for ${action}`, e as Error);
      throw e;
    }
  }
}
