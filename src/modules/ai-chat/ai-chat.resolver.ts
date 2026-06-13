import { Resolver, Mutation, Query, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { AiChatService } from './ai-chat.service';
import { ChatConversation } from './entities/chat-conversation.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { SendChatMessageInput } from './dto/ai-chat.input';

@Resolver(() => ChatConversation)
export class AiChatResolver {
  constructor(private readonly aiChatService: AiChatService) {}

  @Mutation(() => ChatMessage)
  @UseGuards(GqlAuthGuard)
  async sendChatMessage(
    @CurrentUser() user: User,
    @Args('input') input: SendChatMessageInput,
  ): Promise<ChatMessage> {
    return this.aiChatService.sendMessage(user, input);
  }

  @Query(() => [ChatConversation], { name: 'chatConversations' })
  @UseGuards(GqlAuthGuard)
  async chatConversations(@CurrentUser() user: User): Promise<ChatConversation[]> {
    return this.aiChatService.listConversations(user);
  }

  @Query(() => ChatConversation, { name: 'chatConversation' })
  @UseGuards(GqlAuthGuard)
  async chatConversation(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<ChatConversation> {
    return this.aiChatService.getConversation(user, id);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async deleteChatConversation(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.aiChatService.deleteConversation(user, id);
  }
}
