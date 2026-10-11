import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditService } from './audit.service';
import { CryptoService } from './crypto.service';
import { DbService, SystemDbService } from './prisma.service';
import { EventsService } from './events.service';

@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [DbService, SystemDbService, CryptoService, AuditService, EventsService],
  exports: [DbService, SystemDbService, CryptoService, AuditService, EventsService, JwtModule],
})
export class CommonModule {}
