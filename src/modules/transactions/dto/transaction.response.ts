import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Transaction } from '../entities/transaction.entity';

@ObjectType()
export class PaginationMeta {
  @Field(() => Int)
  totalCount: number;

  @Field(() => Int)
  totalPages: number;

  @Field(() => Int)
  currentPage: number;

  @Field(() => Int)
  pageSize: number;

  @Field()
  hasNextPage: boolean;

  @Field()
  hasPreviousPage: boolean;
}

@ObjectType()
export class PaginatedTransactions {
  @Field(() => [Transaction])
  transactions: Transaction[];

  @Field(() => PaginationMeta)
  pagination: PaginationMeta;
}
