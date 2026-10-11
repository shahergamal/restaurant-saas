import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { RequirePermissions } from '../../common/decorators';
import { ZodPipe } from '../../common/zod.pipe';
import { periodQuery } from '../reports/reports.controller';
import { resolvePeriod } from '../reports/range';
import { FoodCostService } from './food-cost.service';

const itemsQuery = periodQuery.extend({ filter: z.enum(['all', 'top', 'low']).default('all') });

@ApiTags('food-cost')
@Controller('food-cost')
export class FoodCostController {
  constructor(private readonly svc: FoodCostService) {}

  @Get('overview')
  @RequirePermissions('food_cost.view')
  overview(@Query(new ZodPipe(periodQuery)) q: z.infer<typeof periodQuery>) {
    return this.svc.overview(resolvePeriod(q), q.branchId);
  }

  @Get('items')
  @RequirePermissions('food_cost.view')
  items(@Query(new ZodPipe(itemsQuery)) q: z.infer<typeof itemsQuery>) {
    return this.svc.items(resolvePeriod(q), q.filter, q.branchId);
  }

  @Get('engineering')
  @RequirePermissions('food_cost.view')
  engineering(@Query(new ZodPipe(periodQuery)) q: z.infer<typeof periodQuery>) {
    return this.svc.engineering(resolvePeriod(q), q.branchId);
  }
}
