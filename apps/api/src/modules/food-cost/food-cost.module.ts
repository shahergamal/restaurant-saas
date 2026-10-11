import { Module } from '@nestjs/common';
import { FoodCostController } from './food-cost.controller';
import { FoodCostService } from './food-cost.service';

@Module({ controllers: [FoodCostController], providers: [FoodCostService] })
export class FoodCostModule {}
