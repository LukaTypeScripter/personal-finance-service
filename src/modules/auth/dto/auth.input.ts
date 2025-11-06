import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsString, MinLength, IsEnum, IsOptional } from 'class-validator';
import { Currency } from '../../../common/enums/currency.enum';

@InputType()
export class RegisterInput {
  @Field()
  @IsString()
  name: string;

  @Field()
  @IsEmail()
  email: string;

  @Field()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @Field({ nullable: true })
  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency;
}

@InputType()
export class LoginInput {
  @Field()
  @IsEmail()
  email: string;

  @Field()
  @IsString()
  password: string;
}
