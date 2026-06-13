import { InputType, Field, ID } from '@nestjs/graphql';
import { IsNotEmpty, IsString, MaxLength, IsOptional, IsUUID } from 'class-validator';

@InputType()
export class SendChatMessageInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message: string;
}
