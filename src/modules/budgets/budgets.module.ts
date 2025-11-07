import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BudgetsService } from './budgets.service';
import { BudgetsResolver } from './budgets.resolver';
import { Budget } from './entities/budget.entity';
import { FinancesModule } from '../finances/finances.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Budget]),
    FinancesModule,
  ],
  providers: [BudgetsService, BudgetsResolver],
  exports: [BudgetsService],
})
export class BudgetsModule {}
