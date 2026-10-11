import { Body, Controller, Get, Injectable, Module, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { settingsSchema } from '@sufra/shared';
import { AuditService } from '../../common/audit.service';
import { AllowWithoutMfa, RequirePermissions } from '../../common/decorators';
import { DbService } from '../../common/prisma.service';
import { ctx } from '../../common/tenant-context';
import { ZodPipe } from '../../common/zod.pipe';

const orgSchema = settingsSchema.omit({ locale: true, numerals: true });
const prefsSchema = settingsSchema.pick({ locale: true, numerals: true });

@Injectable()
export class SettingsService {
  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
  ) {}

  async get() {
    const [org, user, branches] = await Promise.all([
      this.db.client.organization.findFirstOrThrow({
        select: { nameAr: true, nameEn: true, vatNumber: true, crNumber: true, serviceChargeBp: true, delayThresholdMin: true, plan: true },
      }),
      this.db.client.user.findUniqueOrThrow({ where: { id: ctx().userId! }, select: { locale: true, numerals: true, mfaEnabled: true, email: true } }),
      this.db.client.branch.findMany({ select: { id: true, nameAr: true, nameEn: true, address: true }, orderBy: { createdAt: 'asc' } }),
    ]);
    return { organization: org, preferences: user, branches };
  }

  async updateOrg(input: z.infer<typeof orgSchema>) {
    const before = await this.db.client.organization.findFirstOrThrow();
    const updated = await this.db.client.organization.update({
      where: { id: ctx().orgId! },
      data: { ...input, vatNumber: input.vatNumber || null, crNumber: input.crNumber || null },
    });
    await this.audit.log('settings.update', 'organization', updated.id, {
      before: { serviceChargeBp: before.serviceChargeBp, vatNumber: before.vatNumber, delayThresholdMin: before.delayThresholdMin },
      after: input,
    });
    return this.get();
  }

  async updatePrefs(input: z.infer<typeof prefsSchema>) {
    await this.db.client.user.update({ where: { id: ctx().userId! }, data: input });
    return { ok: true };
  }
}

@ApiTags('settings')
@Controller('settings')
class SettingsController {
  constructor(private readonly svc: SettingsService) {}

  @Get()
  @AllowWithoutMfa()
  @RequirePermissions('settings.view')
  get() {
    return this.svc.get();
  }

  @Patch('organization')
  @RequirePermissions('settings.manage')
  updateOrg(@Body(new ZodPipe(orgSchema)) body: z.infer<typeof orgSchema>) {
    return this.svc.updateOrg(body);
  }

  @Patch('preferences')
  @AllowWithoutMfa()
  updatePrefs(@Body(new ZodPipe(prefsSchema)) body: z.infer<typeof prefsSchema>) {
    return this.svc.updatePrefs(body);
  }
}

@Module({ controllers: [SettingsController], providers: [SettingsService] })
export class SettingsModule {}
