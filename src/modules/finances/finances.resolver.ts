import { Resolver, Query, Args, Float } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { FinancesService } from './finances.service';
import { Balance } from './models/balance.model';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { Currency } from '../../common/enums/currency.enum';

@Resolver()
export class FinancesResolver {
  constructor(private readonly financesService: FinancesService) {}

  @Query(() => Balance, { name: 'balance' })
  @UseGuards(GqlAuthGuard)
  async getBalance(
    @CurrentUser() user: User,
    @Args('currency', { nullable: true }) currency?: string,
  ): Promise<Balance> {
    const targetCurrency = (currency as Currency) || user.currency;
    return this.financesService.getBalance(user.id, targetCurrency);
  }

  @Query(() => Float, { name: 'budgetSpending' })
  @UseGuards(GqlAuthGuard)
  async getBudgetSpending(
    @CurrentUser() user: User,
    @Args('category') category: string,
    @Args('currency', { nullable: true }) currency?: string,
  ): Promise<number> {
    const targetCurrency = (currency as Currency) || user.currency;
    return this.financesService.getBudgetSpending(
      user.id,
      category,
      targetCurrency,
    );
  }

  @Query(() => Float, { name: 'exchangeRate' })
  @UseGuards(GqlAuthGuard)
  async getExchangeRate(
    @Args('fromCurrency') fromCurrency: string,
    @Args('toCurrency') toCurrency: string,
  ): Promise<number> {
    return this.financesService.getExchangeRate(
      fromCurrency as Currency,
      toCurrency as Currency,
    );
  }
}
