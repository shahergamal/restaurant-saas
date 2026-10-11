import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { RequirePermissions } from '../../common/decorators';
import { ZodPipe } from '../../common/zod.pipe';
import { DashboardService } from './dashboard.service';

const searchQuery = z.object({ q: z.string().trim().min(1).max(60) });

@ApiTags('dashboard')
@Controller()
export class DashboardController {
  constructor(private readonly svc: DashboardService) {}

  @Get('dashboard')
  @RequirePermissions('dashboard.view')
  summary() {
    return this.svc.summary();
  }

  @Get('notifications')
  notifications() {
    return this.svc.notifications();
  }

  @Get('search')
  search(@Query(new ZodPipe(searchQuery)) q: z.infer<typeof searchQuery>) {
    return this.svc.search(q.q);
  }
}
