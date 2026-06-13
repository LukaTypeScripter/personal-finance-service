import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { AiChatService } from './ai-chat.service';
import { ChatConversation } from './entities/chat-conversation.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { GrokService } from './grok.service';
import { FinanceContextService } from './finance-context.service';
import { ChatRole } from './enums/chat-role.enum';
import { Currency } from '../../common/enums/currency.enum';

const user = { id: 'u1', currency: Currency.USD } as any;

describe('AiChatService', () => {
  let service: AiChatService;
  let convRepo: any;
  let msgRepo: any;
  let grok: any;
  let context: any;

  beforeEach(async () => {
    convRepo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: x.id ?? 'c1', ...x })),
      findOne: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    };
    msgRepo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: 'm1', ...x })),
      find: jest.fn().mockResolvedValue([]),
    };
    grok = { chat: jest.fn().mockResolvedValue('AI reply') };
    context = { buildSystemPrompt: jest.fn().mockResolvedValue('SYSTEM') };

    const m = await Test.createTestingModule({
      providers: [
        AiChatService,
        { provide: getRepositoryToken(ChatConversation), useValue: convRepo },
        { provide: getRepositoryToken(ChatMessage), useValue: msgRepo },
        { provide: GrokService, useValue: grok },
        { provide: FinanceContextService, useValue: context },
      ],
    }).compile();
    service = m.get(AiChatService);
  });

  it('rejects an empty/whitespace message', async () => {
    await expect(service.sendMessage(user, { message: '   ' }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a new conversation when no id is given and returns assistant reply', async () => {
    const result = await service.sendMessage(user, { message: 'hello' });
    expect(context.buildSystemPrompt).toHaveBeenCalledWith('u1', Currency.USD);
    expect(grok.chat).toHaveBeenCalled();
    expect(result.role).toBe(ChatRole.ASSISTANT);
    expect(result.content).toBe('AI reply');
    expect(msgRepo.save).toHaveBeenCalledTimes(2);
  });

  it('throws NotFound when conversationId does not exist', async () => {
    convRepo.findOne.mockResolvedValue(null);
    await expect(service.sendMessage(user, { conversationId: 'missing', message: 'hi' }))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws Forbidden when conversation belongs to another user', async () => {
    convRepo.findOne.mockResolvedValue({ id: 'c1', userId: 'someone-else' });
    await expect(service.sendMessage(user, { conversationId: 'c1', message: 'hi' }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('listConversations returns only the user conversations', async () => {
    convRepo.find.mockResolvedValue([{ id: 'c1', userId: 'u1' }]);
    const list = await service.listConversations(user);
    expect(convRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1' } }),
    );
    expect(list).toHaveLength(1);
  });

  it('deleteConversation enforces ownership', async () => {
    convRepo.findOne.mockResolvedValue({ id: 'c1', userId: 'someone-else' });
    await expect(service.deleteConversation(user, 'c1'))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('sends the most recent history (newest N), in chronological order, to Grok', async () => {
    // Simulate a repo that honors order+take: newest-first when DESC.
    msgRepo.find.mockImplementation(async (opts: any) => {
      const all = Array.from({ length: 25 }, (_, i) => ({
        id: `h${i}`,
        role: ChatRole.USER,
        content: `msg ${i}`, // msg 24 is newest
        createdAt: new Date(2020, 0, 1, 0, i),
      }));
      const dir = opts?.order?.createdAt;
      const sorted = dir === 'DESC' ? [...all].reverse() : all;
      return opts?.take ? sorted.slice(0, opts.take) : sorted;
    });

    await service.sendMessage(user, { conversationId: undefined, message: 'latest' });

    const grokArgs = grok.chat.mock.calls[0][0]; // GrokChatMessage[]
    const history = grokArgs.slice(1); // drop the system prompt
    expect(history.length).toBe(20); // MAX_HISTORY
    // must be chronological (oldest -> newest)
    expect(history[history.length - 1].content).toBe('msg 24');
    // must NOT contain the oldest messages that were dropped
    expect(history.some((m: any) => m.content === 'msg 0')).toBe(false);
  });

  it('getConversation returns an owned conversation with messages ordered ASC', async () => {
    convRepo.findOne.mockResolvedValue({ id: 'c1', userId: 'u1' });
    msgRepo.find.mockResolvedValue([{ id: 'm1', role: ChatRole.USER, content: 'hi' }]);
    const conv = await service.getConversation(user, 'c1');
    expect(conv.id).toBe('c1');
    expect(conv.messages).toHaveLength(1);
    expect(msgRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { conversationId: 'c1' }, order: { createdAt: 'ASC' } }),
    );
  });
});
