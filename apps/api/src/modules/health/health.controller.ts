import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators';
import { SystemDbService } from '../../common/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly sys: SystemDbService) {}

  @Public()
  @SkipThrottle()
  @Get()
  async health() {
    await this.sys.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }
}
