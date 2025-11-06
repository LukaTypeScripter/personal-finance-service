import { InputType, Field, Float, registerEnumType } from '@nestjs/graphql';
import { IsString, IsNumber, IsBoolean, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { Currency } from '../../../common/enums/currency.enum';

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export enum TransactionSortField {
  NAME = 'name',
  CATEGORY = 'category',
  DATE = 'date',
  AMOUNT = 'amount',
  CREATED_AT = 'createdAt',
}

registerEnumType(SortOrder, {
  name: 'SortOrder',
  description: 'Sort order (ascending or descending)',
});

registerEnumType(TransactionSortField, {
  name: 'TransactionSortField',
  description: 'Field to sort transactions by',
});

@InputType()
export class CreateTransactionInput {
  @Field()
  @IsString()
  name: string;

  @Field()
  @IsString()
  category: string;

  @Field()
  @IsDateString()
  date: string;

  @Field(() => Float)
  @IsNumber()
  amount: number;

  @Field({ nullable: true })
  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  avatar?: string;

  @Field({ defaultValue: false })
  @IsBoolean()
  @IsOptional()
  recurring?: boolean;
}

@InputType()
export class UpdateTransactionInput {
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  name?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  category?: string;

  @Field({ nullable: true })
  @IsDateString()
  @IsOptional()
  date?: string;

  @Field(() => Float, { nullable: true })
  @IsNumber()
  @IsOptional()
  amount?: number;

  @Field({ nullable: true })
  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  avatar?: string;

  @Field({ nullable: true })
  @IsBoolean()
  @IsOptional()
  recurring?: boolean;
}

@InputType()
export class FilterTransactionsInput {
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  name?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  category?: string;

  @Field({ nullable: true })
  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency;

  @Field({ nullable: true })
  @IsBoolean()
  @IsOptional()
  recurring?: boolean;

  @Field(() => Float, { nullable: true })
  @IsNumber()
  @IsOptional()
  minAmount?: number;

  @Field(() => Float, { nullable: true })
  @IsNumber()
  @IsOptional()
  maxAmount?: number;

  @Field({ nullable: true })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @Field({ nullable: true })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}

@InputType()
export class SortTransactionsInput {
  @Field(() => TransactionSortField, { defaultValue: TransactionSortField.DATE })
  @IsEnum(TransactionSortField)
  @IsOptional()
  sortBy?: TransactionSortField;

  @Field(() => SortOrder, { defaultValue: SortOrder.DESC })
  @IsEnum(SortOrder)
  @IsOptional()
  sortOrder?: SortOrder;
}
