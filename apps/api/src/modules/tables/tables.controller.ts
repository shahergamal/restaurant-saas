import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { updateTableSchema } from '@sufra/shared';
import { RequirePermissions } from '../../common/decorators';
import { ZodPipe } from '../../common/zod.pipe';
import { TablesService } from './tables.service';

const moveSchema = z.object({ toTableId: z.string().uuid() });

@ApiTags('tables')
@Controller()
export class TablesController {
  constructor(private readonly tables: TablesService) {}

  @Get('floors')
  @RequirePermissions('tables.view')
  floors() {
    return this.tables.floors();
  }

  @Get('tables/summary')
  @RequirePermissions('tables.view')
  summary() {
    return this.tables.summary();
  }

  @Get('tables/waiters')
  @RequirePermissions('tables.view')
  waiters() {
    return this.tables.waiters();
  }

  @Get('tables/:id')
  @RequirePermissions('tables.view')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.tables.detail(id);
  }

  @Patch('tables/:id')
  @RequirePermissions('tables.manage')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(updateTableSchema)) body: z.infer<typeof updateTableSchema>) {
    return this.tables.update(id, body);
  }

  @Post('tables/:id/move')
  @HttpCode(200)
  @RequirePermissions('tables.manage')
  move(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(moveSchema)) body: z.infer<typeof moveSchema>) {
    return this.tables.move(id, body.toTableId);
  }
}
