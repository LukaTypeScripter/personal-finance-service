import { Resolver, Query, Mutation, Args, Float } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { PotsService } from './pots.service';
import { Pot } from './entities/pot.entity';
import { CreatePotInput, UpdatePotInput } from './dto/pot.input';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { Currency } from '../../common/enums/currency.enum';

@Resolver(() => Pot)
export class PotsResolver {
  constructor(private readonly potsService: PotsService) {}

  @Query(() => [Pot], { name: 'pots' })
  @UseGuards(GqlAuthGuard)
  async findAll(
    @CurrentUser() user: User,
    @Args('currency', { nullable: true }) currency?: Currency,
  ): Promise<Pot[]> {
    return this.potsService.findAll(user.id, currency);
  }

  @Query(() => Pot, { name: 'pot' })
  @UseGuards(GqlAuthGuard)
  async findOne(
    @CurrentUser() user: User,
    @Args('id') id: string,
    @Args('currency', { nullable: true }) currency?: Currency,
  ): Promise<Pot> {
    return this.potsService.findOne(id, user.id, currency);
  }

  @Mutation(() => Pot)
  @UseGuards(GqlAuthGuard)
  async createPot(
    @CurrentUser() user: User,
    @Args('input') input: CreatePotInput,
  ): Promise<Pot> {
    return this.potsService.create(user.id, input, user.currency);
  }

  @Mutation(() => Pot)
  @UseGuards(GqlAuthGuard)
  async updatePot(
    @CurrentUser() user: User,
    @Args('id') id: string,
    @Args('input') input: UpdatePotInput,
  ): Promise<Pot> {
    return this.potsService.update(id, user.id, input);
  }

  @Mutation(() => Pot)
  @UseGuards(GqlAuthGuard)
  async addMoneyToPot(
    @CurrentUser() user: User,
    @Args('id') id: string,
    @Args('amount', { type: () => Float }) amount: number,
  ): Promise<Pot> {
    return this.potsService.addMoney(id, user.id, amount);
  }

  @Mutation(() => Pot)
  @UseGuards(GqlAuthGuard)
  async withdrawMoneyFromPot(
    @CurrentUser() user: User,
    @Args('id') id: string,
    @Args('amount', { type: () => Float }) amount: number,
  ): Promise<Pot> {
    return this.potsService.withdrawMoney(id, user.id, amount);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async deletePot(
    @CurrentUser() user: User,
    @Args('id') id: string,
  ): Promise<boolean> {
    return this.potsService.remove(id, user.id);
  }
}
