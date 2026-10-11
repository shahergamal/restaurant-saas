import { Module } from '@nestjs/common';
import { KitchenController } from './kitchen.controller';
import { KitchenService } from './kitchen.service';
import { RealtimeGateway } from './realtime.gateway';

@Module({ controllers: [KitchenController], providers: [KitchenService, RealtimeGateway] })
export class KitchenModule {}
