import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { Transaction } from './entities/transaction.entity';
import {
  CreateTransactionInput,
  UpdateTransactionInput,
  FilterTransactionsInput,
  SortTransactionsInput
} from './dto/transaction.input';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Resolver(() => Transaction)
export class TransactionsResolver {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Query(() => [Transaction], { name: 'transactions' })
  @UseGuards(GqlAuthGuard)
  async findAll(
    @CurrentUser() user: User,
    @Args('skip', { type: () => Int, nullable: true }) skip?: number,
    @Args('take', { type: () => Int, nullable: true }) take?: number,
    @Args('filter', { nullable: true }) filter?: FilterTransactionsInput,
    @Args('sort', { nullable: true }) sort?: SortTransactionsInput,
  ): Promise<Transaction[]> {
    return this.transactionsService.findAll(user.id, {
      skip,
      take,
      filter,
      sort,
    });
  }

  @Query(() => Transaction, { name: 'transaction' })
  @UseGuards(GqlAuthGuard)
  async findOne(
    @CurrentUser() user: User,
    @Args('id') id: string,
  ): Promise<Transaction> {
    return this.transactionsService.findOne(id, user.id);
  }

  @Query(() => [Transaction], { name: 'recurringTransactions' })
  @UseGuards(GqlAuthGuard)
  async findRecurring(@CurrentUser() user: User): Promise<Transaction[]> {
    return this.transactionsService.getRecurringTransactions(user.id);
  }

  @Query(() => [Transaction], { name: 'transactionsByCategory' })
  @UseGuards(GqlAuthGuard)
  async findByCategory(
    @CurrentUser() user: User,
    @Args('category') category: string,
  ): Promise<Transaction[]> {
    return this.transactionsService.getTransactionsByCategory(user.id, category);
  }

  @Mutation(() => Transaction)
  @UseGuards(GqlAuthGuard)
  async createTransaction(
    @CurrentUser() user: User,
    @Args('input') input: CreateTransactionInput,
  ): Promise<Transaction> {
    return this.transactionsService.create(user.id, input, user.currency);
  }

  @Mutation(() => Transaction)
  @UseGuards(GqlAuthGuard)
  async updateTransaction(
    @CurrentUser() user: User,
    @Args('id') id: string,
    @Args('input') input: UpdateTransactionInput,
  ): Promise<Transaction> {
    return this.transactionsService.update(id, user.id, input);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async deleteTransaction(
    @CurrentUser() user: User,
    @Args('id') id: string,
  ): Promise<boolean> {
    return this.transactionsService.remove(id, user.id);
  }
}
