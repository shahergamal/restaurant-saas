import { Body, ConflictException, Controller, Get, Injectable, Module, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ROLES } from '@sufra/shared';
import { AuditService } from '../../common/audit.service';
import { RequirePermissions } from '../../common/decorators';
import { DbService } from '../../common/prisma.service';
import { ctx } from '../../common/tenant-context';
import { ZodPipe } from '../../common/zod.pipe';
import { AuthService } from '../auth/auth.service';

const createSchema = z.object({
  nameAr: z.string().trim().min(2).max(80),
  nameEn: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().regex(/^\+?\d{9,15}$/).optional(),
  role: z.enum(ROLES),
  password: z.string().min(10).max(200),
});

@Injectable()
class StaffService {
  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const users = await this.db.client.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, nameAr: true, nameEn: true, email: true, phone: true, active: true, mfaEnabled: true, roles: { select: { role: true } } },
    });
    return users.map((u) => ({ ...u, roles: [...new Set(u.roles.map((r) => r.role))] }));
  }

  async create(input: z.infer<typeof createSchema>) {
    const orgId = ctx().orgId!;
    const passwordHash = await AuthService.hashPassword(input.password);
    try {
      const user = await this.db.client.user.create({
        data: {
          organizationId: orgId, nameAr: input.nameAr, nameEn: input.nameEn, email: input.email, phone: input.phone, passwordHash,
          roles: { create: { organizationId: orgId, role: input.role } },
        },
      });
      await this.audit.log('staff.create', 'user', user.id, { email: input.email, role: input.role });
      return { id: user.id };
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') throw new ConflictException('email_taken');
      throw e;
    }
  }
}

@ApiTags('staff')
@Controller('staff')
class StaffController {
  constructor(private readonly svc: StaffService) {}

  @Get()
  @RequirePermissions('tables.view')
  list() {
    return this.svc.list();
  }

  @Post()
  @RequirePermissions('staff.manage')
  create(@Body(new ZodPipe(createSchema)) body: z.infer<typeof createSchema>) {
    return this.svc.create(body);
  }
}

@Module({ controllers: [StaffController], providers: [StaffService] })
export class StaffModule {}
