import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators';
import { KitchenService } from './kitchen.service';

@ApiTags('kitchen')
@Controller('kitchen')
export class KitchenController {
  constructor(private readonly kitchen: KitchenService) {}

  @Get('board')
  @RequirePermissions('kitchen.view')
  board() {
    return this.kitchen.board();
  }

  @Get('performance')
  @RequirePermissions('kitchen.view')
  performance() {
    return this.kitchen.performance();
  }

  @Get('tickets/:id')
  @RequirePermissions('kitchen.view')
  ticket(@Param('id', ParseUUIDPipe) id: string) {
    return this.kitchen.ticket(id);
  }

  @Patch('tickets/:id/ready')
  @HttpCode(200)
  @RequirePermissions('kitchen.update')
  ready(@Param('id', ParseUUIDPipe) id: string) {
    return this.kitchen.markReady(id);
  }
}
