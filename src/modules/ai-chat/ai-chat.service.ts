import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatConversation } from './entities/chat-conversation.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatRole } from './enums/chat-role.enum';
import { GrokService } from './grok.service';
import { FinanceContextService } from './finance-context.service';
import { SendChatMessageInput } from './dto/ai-chat.input';
import { GrokChatMessage } from './dto/grok.types';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AiChatService {
  private readonly MAX_HISTORY = 20;

  constructor(
    @InjectRepository(ChatConversation)
    private readonly conversationRepo: Repository<ChatConversation>,
    @InjectRepository(ChatMessage)
    private readonly messageRepo: Repository<ChatMessage>,
    private readonly grok: GrokService,
    private readonly financeContext: FinanceContextService,
  ) {}

  async sendMessage(
    user: User,
    input: SendChatMessageInput,
  ): Promise<ChatMessage> {
    const message = input.message?.trim();
    if (!message) {
      throw new BadRequestException('Message cannot be empty');
    }

    const conversation = await this.resolveConversation(
      user,
      input.conversationId,
      message,
    );

    await this.messageRepo.save(
      this.messageRepo.create({
        conversationId: conversation.id,
        role: ChatRole.USER,
        content: message,
      }),
    );

    const history = await this.messageRepo.find({
      where: { conversationId: conversation.id },
      order: { createdAt: 'ASC' },
      take: this.MAX_HISTORY,
    });

    const systemPrompt = await this.financeContext.buildSystemPrompt(
      user.id,
      user.currency,
    );

    const grokMessages: GrokChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({
        role:
          m.role === ChatRole.USER
            ? ('user' as const)
            : ('assistant' as const),
        content: m.content,
      })),
    ];

    const reply = await this.grok.chat(grokMessages);

    const assistantMessage = await this.messageRepo.save(
      this.messageRepo.create({
        conversationId: conversation.id,
        role: ChatRole.ASSISTANT,
        content: reply,
      }),
    );

    await this.conversationRepo.update(conversation.id, {
      updatedAt: new Date(),
    });

    return assistantMessage;
  }

  async listConversations(user: User): Promise<ChatConversation[]> {
    return this.conversationRepo.find({
      where: { userId: user.id },
      order: { updatedAt: 'DESC' },
    });
  }

  async getConversation(user: User, id: string): Promise<ChatConversation> {
    const conversation = await this.ownedConversation(user, id);
    conversation.messages = await this.messageRepo.find({
      where: { conversationId: id },
      order: { createdAt: 'ASC' },
    });
    return conversation;
  }

  async deleteConversation(user: User, id: string): Promise<boolean> {
    await this.ownedConversation(user, id);
    await this.conversationRepo.delete(id);
    return true;
  }

  private async resolveConversation(
    user: User,
    id: string | undefined,
    firstMessage: string,
  ): Promise<ChatConversation> {
    if (id) {
      return this.ownedConversation(user, id);
    }
    return this.conversationRepo.save(
      this.conversationRepo.create({
        userId: user.id,
        title: firstMessage.slice(0, 50),
      }),
    );
  }

  private async ownedConversation(
    user: User,
    id: string,
  ): Promise<ChatConversation> {
    const conversation = await this.conversationRepo.findOne({ where: { id } });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    if (conversation.userId !== user.id) {
      throw new ForbiddenException(
        'You do not have access to this conversation',
      );
    }
    return conversation;
  }
}
