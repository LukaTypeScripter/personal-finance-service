import { registerEnumType } from '@nestjs/graphql';

export enum ChatRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

registerEnumType(ChatRole, { name: 'ChatRole' });
