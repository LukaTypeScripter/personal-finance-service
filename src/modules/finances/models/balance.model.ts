import { ObjectType, Field, Float } from '@nestjs/graphql';

@ObjectType()
export class Balance {
  @Field(() => Float)
  current: number;

  @Field(() => Float)
  income: number;

  @Field(() => Float)
  expenses: number;

  @Field()
  currency: string;
}
