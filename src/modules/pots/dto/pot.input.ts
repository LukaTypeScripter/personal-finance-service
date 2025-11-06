import { InputType, Field, Float } from '@nestjs/graphql';
import { IsString, IsNumber, IsEnum, IsOptional } from 'class-validator';
import { Currency } from '../../../common/enums/currency.enum';

@InputType()
export class CreatePotInput {
  @Field()
  @IsString()
  name: string;

  @Field(() => Float)
  @IsNumber()
  target: number;

  @Field(() => Float, { nullable: true, defaultValue: 0 })
  @IsNumber()
  @IsOptional()
  total?: number;

  @Field({ nullable: true })
  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency;

  @Field()
  @IsString()
  theme: string;
}

@InputType()
export class UpdatePotInput {
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  name?: string;

  @Field(() => Float, { nullable: true })
  @IsNumber()
  @IsOptional()
  target?: number;

  @Field(() => Float, { nullable: true })
  @IsNumber()
  @IsOptional()
  total?: number;

  @Field({ nullable: true })
  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  theme?: string;
}
