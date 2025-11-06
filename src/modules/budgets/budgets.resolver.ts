import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { Budget } from './entities/budget.entity';
import { CreateBudgetInput, UpdateBudgetInput } from './dto/budget.input';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Resolver(() => Budget)
export class BudgetsResolver {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Query(() => [Budget], { name: 'budgets' })
  @UseGuards(GqlAuthGuard)
  async findAll(@CurrentUser() user: User): Promise<Budget[]> {
    return this.budgetsService.findAll(user.id);
  }

  @Query(() => Budget, { name: 'budget' })
  @UseGuards(GqlAuthGuard)
  async findOne(
    @CurrentUser() user: User,
    @Args('id') id: string,
  ): Promise<Budget> {
    return this.budgetsService.findOne(id, user.id);
  }

  @Query(() => Budget, { name: 'budgetByCategory' })
  @UseGuards(GqlAuthGuard)
  async findByCategory(
    @CurrentUser() user: User,
    @Args('category') category: string,
  ): Promise<Budget> {
    return this.budgetsService.findByCategory(user.id, category);
  }

  @Mutation(() => Budget)
  @UseGuards(GqlAuthGuard)
  async createBudget(
    @CurrentUser() user: User,
    @Args('input') input: CreateBudgetInput,
  ): Promise<Budget> {
    return this.budgetsService.create(user.id, input, user.currency);
  }

  @Mutation(() => Budget)
  @UseGuards(GqlAuthGuard)
  async updateBudget(
    @CurrentUser() user: User,
    @Args('id') id: string,
    @Args('input') input: UpdateBudgetInput,
  ): Promise<Budget> {
    return this.budgetsService.update(id, user.id, input);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async deleteBudget(
    @CurrentUser() user: User,
    @Args('id') id: string,
  ): Promise<boolean> {
    return this.budgetsService.remove(id, user.id);
  }
}
