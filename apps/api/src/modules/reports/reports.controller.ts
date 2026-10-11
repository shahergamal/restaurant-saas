import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { RequirePermissions } from '../../common/decorators';
import { ZodPipe } from '../../common/zod.pipe';
import { resolvePeriod } from './range';
import { ReportsService } from './reports.service';

export const periodQuery = z.object({
  range: z.enum(['today', '7d', '30d']).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  branchId: z.string().uuid().optional(),
});

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('overview')
  @RequirePermissions('reports.view')
  overview(@Query(new ZodPipe(periodQuery)) q: z.infer<typeof periodQuery>) {
    return this.reports.overview(resolvePeriod(q), q.branchId);
  }

  @Get('vat')
  @RequirePermissions('reports.view')
  vat(@Query(new ZodPipe(periodQuery)) q: z.infer<typeof periodQuery>) {
    return this.reports.vat(resolvePeriod(q));
  }

  @Get('export.csv')
  @RequirePermissions('reports.view')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="report.csv"')
  export(@Query(new ZodPipe(periodQuery)) q: z.infer<typeof periodQuery>) {
    return this.reports.csv(resolvePeriod(q), q.branchId);
  }
}
