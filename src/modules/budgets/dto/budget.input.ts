import { InputType, Field, Float } from '@nestjs/graphql';
import { IsString, IsNumber, IsEnum, IsOptional } from 'class-validator';
import { Currency } from '../../../common/enums/currency.enum';

@InputType()
export class CreateBudgetInput {
  @Field()
  @IsString()
  category: string;

  @Field(() => Float)
  @IsNumber()
  maximum: number;

  @Field({ nullable: true })
  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency;

  @Field()
  @IsString()
  theme: string;
}

@InputType()
export class UpdateBudgetInput {
  @Field(() => Float, { nullable: true })
  @IsNumber()
  @IsOptional()
  maximum?: number;

  @Field({ nullable: true })
  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  theme?: string;
}
