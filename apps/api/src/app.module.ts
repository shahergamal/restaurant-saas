import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { NextFunction, Request, Response } from 'express';
import { CommonModule } from './common/common.module';
import { AuthGuard, OriginGuard, PermissionsGuard } from './common/guards';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { requestContext } from './common/tenant-context';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DirectoryModule } from './modules/directory/directory.module';
import { FoodCostModule } from './modules/food-cost/food-cost.module';
import { HealthController } from './modules/health/health.controller';
import { InventoryModule } from './modules/inventory/inventory.module';
import { KitchenModule } from './modules/kitchen/kitchen.module';
import { MenuModule } from './modules/menu/menu.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { SettingsModule } from './modules/settings/settings.module';
import { StaffModule } from './modules/staff/staff.module';
import { TablesModule } from './modules/tables/tables.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    CommonModule,
    AuthModule,
    DashboardModule,
    OrdersModule,
    TablesModule,
    KitchenModule,
    InventoryModule,
    ReportsModule,
    FoodCostModule,
    SettingsModule,
    MenuModule,
    StaffModule,
    ReservationsModule,
    DirectoryModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // One request context per HTTP request; the auth guard fills in the tenant.
    consumer
      .apply((req: Request, _res: Response, next: NextFunction) => requestContext.run({ ip: req.ip }, () => next()))
      .forRoutes('*path');
  }
}
