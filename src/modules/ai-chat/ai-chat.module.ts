import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatConversation } from './entities/chat-conversation.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { GrokService } from './grok.service';
import { FinanceContextService } from './finance-context.service';
import { AiChatService } from './ai-chat.service';
import { AiChatResolver } from './ai-chat.resolver';
import { FinancesModule } from '../finances/finances.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { PotsModule } from '../pots/pots.module';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([ChatConversation, ChatMessage]),
    FinancesModule,
    TransactionsModule,
    BudgetsModule,
    PotsModule,
  ],
  providers: [GrokService, FinanceContextService, AiChatService, AiChatResolver],
})
export class AiChatModule {}
