# Grok AI Chat + First-Page Fix + Playwright + Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a finance-aware Grok (xAI) AI chat to the personal-finance app (NestJS backend + Angular frontend), fix the broken Overview page seen right after registering, add Playwright view tests, and harden the frontend data-loading code.

**Architecture:** Backend gets a new `ai-chat` GraphQL module mirroring the existing resolver→service→entity pattern and the `ExchangeRatesService` HTTP pattern; conversations/messages persist in Postgres; a `FinanceContextService` injects the user's financial summary as a system prompt. Frontend gets a `/dashboard/assistant` route with a signal-based chat service/component reusing Apollo. The Overview bug is fixed by hardening null handling and currency resolution in `Api`.

**Tech Stack:** NestJS 11, GraphQL/Apollo, TypeORM/Postgres, `@nestjs/axios`, Jest (backend); Angular 20 standalone + signals, apollo-angular, Playwright (frontend).

**Two repos:**
- Backend: `C:\Users\lshinjikashvili\Desktop\testing\personal-finance-service`
- Frontend: `C:\Users\lshinjikashvili\Desktop\testing\personal-finance-app-angular`

Run all backend commands from the backend repo, frontend commands from the frontend repo.

---

## Phase 1 — Fix the "first page bugged after creating a new account" bug + harden `Api`

### Task 1: Reproduce and diagnose (systematic-debugging)

**Files:** none yet (investigation).

- [ ] **Step 1: Start backend + frontend**

Run (backend): `npm run start:dev`
Run (frontend, separate shell): `npm start`
Expected: backend on `http://localhost:3000/graphql`, frontend on `http://localhost:4200`.

- [ ] **Step 2: Reproduce via Playwright MCP (or browser)**

Navigate to `http://localhost:4200/auth/register`, register a brand-new user (unique email, currency `GEO`), submit, and observe `/dashboard/overview`. Open the browser console (`browser_console_messages`) and capture any errors. Record exactly what is broken (blank cards, stuck spinner, console TypeError, wrong currency).

- [ ] **Step 3: Record findings**

Write a one-paragraph root-cause note in the PR/commit description. Confirm which hypothesis holds:
  1. **Currency race** — `Overview.ngOnInit` passes `this.api.currency()` which is still stale `'USD'` because the `Api` constructor `effect()` syncing the registered user's currency hasn't flushed yet.
  2. **Uncaught null deref** — in `Api.loadOverviewData`, `data.transactions.transactions` (and `data.balance` / `data.pots` / `data.budgets`) are read inside `.subscribe`, *after* `catchError`; for a new account a null field throws an uncaught error and `_loading` stays `true`.

The fix in Task 2 addresses both regardless of which reproduces, so proceed even if only one is observed.

### Task 2: Harden `Api.loadOverviewData` and currency resolution

**Files:**
- Modify: `personal-finance-app-angular/src/app/shared/service/api.ts`
- Modify: `personal-finance-app-angular/src/app/pages/overview/overview.ts`
- Test: `personal-finance-app-angular/src/app/shared/service/api.spec.ts` (create)

- [ ] **Step 1: Write failing tests for safe overview handling**

Create `api.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { Apollo } from 'apollo-angular';
import { of, throwError } from 'rxjs';
import { Api } from './api';
import { AuthService } from '@/app/core/service/auth.service';

describe('Api.loadOverviewData', () => {
  let api: Api;
  let apollo: { query: jasmine.Spy };

  function configure(queryReturn: any) {
    apollo = { query: jasmine.createSpy('query').and.returnValue(queryReturn) };
    TestBed.configureTestingModule({
      providers: [
        Api,
        { provide: Apollo, useValue: apollo },
        { provide: AuthService, useValue: { currentUser: () => ({ currency: 'USD' }) } },
      ],
    });
    api = TestBed.inject(Api);
  }

  it('clears loading and does not throw when the payload has null sub-fields', () => {
    configure(of({ data: { balance: null, transactions: null, pots: null, budgets: null } }));
    expect(() => api.loadOverviewData('USD')).not.toThrow();
    expect(api.loading()).toBe(false);
    expect(api.transactions()).toEqual([]);
  });

  it('clears loading when the query errors', () => {
    configure(throwError(() => new Error('network')));
    api.loadOverviewData('USD');
    expect(api.loading()).toBe(false);
  });

  it('populates signals from a well-formed payload', () => {
    configure(of({ data: {
      balance: { current: 10, income: 10, expenses: 0, currency: 'USD' },
      transactions: { transactions: [{ id: '1', name: 'x' }], pagination: { totalCount: 1 } },
      pots: [{ id: 'p1', name: 'Trip' }],
      budgets: [{ id: 'b1', category: 'Food' }],
    }}));
    api.loadOverviewData('USD');
    expect(api.transactions().length).toBe(1);
    expect(api.pots().length).toBe(1);
    expect(api.balance().current).toBe(10);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test -- --watch=false --browsers=ChromeHeadless`
Expected: FAIL (current code throws on null `data.transactions.transactions` / leaves loading true).

- [ ] **Step 3: Implement the hardened `loadOverviewData`**

Replace the `loadOverviewData` method body in `api.ts` with null-safe access (note the `?.` and `?? []`):

```ts
  loadOverviewData(currency?: Currency): void {
    this._loading.set(true);

    const curr = this.resolveCurrency(currency);

    this.apollo
      .query<{
        balance: Balance | null;
        transactions: PaginatedTransactions | null;
        budgets: Budget[] | null;
        pots: Pot[] | null;
      }>({
        query: GET_OVERVIEW_DATA_QUERY,
        variables: { currency: curr },
        fetchPolicy: 'network-only',
      })
      .pipe(
        map(result => result?.data ?? null),
        catchError(error => {
          console.error('Error loading overview data:', error);
          return of(null);
        }),
      )
      .subscribe({
        next: data => {
          if (data) {
            this.setSafeData(this._balance, data.balance);
            this.setSafeData(this._transactions, data.transactions?.transactions ?? []);
            this._paginationMeta.set(data.transactions?.pagination ?? null);
            this.setSafeData(this._pots, data.pots ?? [], p => !!p && !!p.name);
            this.setSafeData(this._budgets, data.budgets ?? []);
          }
          this._loading.set(false);
        },
        error: () => this._loading.set(false),
      });
  }
```

- [ ] **Step 4: Fix the currency race in `overview.ts`**

Change `ngOnInit` to let the service resolve the freshest currency (from the just-registered user) instead of passing the possibly-stale signal:

```ts
  ngOnInit(): void {
    this.api.loadOverviewData();
  }
```

And update `resolveCurrency` in `api.ts` to prefer the authenticated user's currency over the stale local signal:

```ts
  private resolveCurrency(currency?: Currency): Currency {
    return currency || this.authService.currentUser()?.currency || this.currency() || 'USD';
  }
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `npm test -- --watch=false --browsers=ChromeHeadless`
Expected: PASS.

- [ ] **Step 6: Manually re-verify the original repro**

Re-run the Task 1 repro (register new GEO user). Expected: Overview renders empty-but-correct cards, no console error, no stuck spinner, currency shows GEO.

- [ ] **Step 7: Commit**

```bash
git add src/app/shared/service/api.ts src/app/pages/overview/overview.ts src/app/shared/service/api.spec.ts
git commit -m "fix: harden overview data loading and currency resolution after registration"
```

### Task 3: Refactor `Api` query boilerplate (scoped)

**Files:**
- Modify: `personal-finance-app-angular/src/app/shared/service/api.ts`
- Test: `personal-finance-app-angular/src/app/shared/service/api.spec.ts` (extend)

- [ ] **Step 1: Add a test that `loadBalance` still works after refactor**

Append to `api.spec.ts`:

```ts
describe('Api.loadBalance', () => {
  it('sets balance from query result', () => {
    const apollo = { query: jasmine.createSpy().and.returnValue(
      of({ data: { balance: { current: 5, income: 5, expenses: 0, currency: 'USD' } } })) };
    TestBed.configureTestingModule({
      providers: [
        Api,
        { provide: Apollo, useValue: apollo },
        { provide: AuthService, useValue: { currentUser: () => ({ currency: 'USD' }) } },
      ],
    });
    const api = TestBed.inject(Api);
    api.loadBalance('USD');
    expect(api.balance().current).toBe(5);
  });
});
```

- [ ] **Step 2: Run, verify pass (no refactor yet)**

Run: `npm test -- --watch=false --browsers=ChromeHeadless`
Expected: PASS.

- [ ] **Step 3: Extract a private `runQuery` helper to remove duplication**

Add this helper to `api.ts` and rewrite `loadBalance`, `loadTransactions`, `loadBudgets`, `loadPots` to use it. The helper centralizes `fetchPolicy`, error logging, and fallback:

```ts
  private runQuery<TData, TResult>(
    query: any,
    variables: Record<string, unknown>,
    select: (data: TData | undefined) => TResult,
    fallback: TResult,
    label: string,
  ) {
    return this.apollo
      .query<TData>({ query, variables, fetchPolicy: 'network-only' })
      .pipe(
        map(result => select(result?.data)),
        catchError(error => {
          console.error(`Error loading ${label}:`, error);
          return of(fallback);
        }),
      );
  }
```

Example rewrite of `loadBalance`:

```ts
  loadBalance(currency?: Currency): void {
    const curr = this.resolveCurrency(currency);
    this.runQuery<{ balance: Balance }, Balance>(
      GET_BALANCE_QUERY,
      { currency: curr },
      data => data?.balance ?? DEFAULT_FINANCE_DATA.balance,
      DEFAULT_FINANCE_DATA.balance,
      'balance',
    ).subscribe(balance => this._balance.set(balance));
  }
```

Apply the same shape to `loadTransactions` (select `data?.transactions`, fallback `null`, and inside subscribe set `_loading(false)` then guard null), `loadBudgets` (fallback `[]`), and `loadPots` (fallback `[]`, filter `!!pot && !!pot.name`).

- [ ] **Step 4: Run tests, verify pass**

Run: `npm test -- --watch=false --browsers=ChromeHeadless`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/service/api.ts src/app/shared/service/api.spec.ts
git commit -m "refactor: extract shared runQuery helper in Api service"
```

---

## Phase 2 — Backend Grok AI chat module

All paths below are under `personal-finance-service/`.

### Task 4: Config + env wiring for xAI

**Files:**
- Modify: `.env.example`
- Modify: `.env` (local only; add real key — do NOT commit `.env`)

- [ ] **Step 1: Add placeholders to `.env.example`**

Append:

```
# xAI Grok AI chat
XAI_API_KEY=your-xai-api-key-here
XAI_MODEL=grok-4
XAI_BASE_URL=https://api.x.ai/v1
```

- [ ] **Step 2: Add the real key to local `.env`**

Append the same three keys to `.env` with the real `XAI_API_KEY` value. Confirm `.env` is in `.gitignore` (it is). Never commit the real key.

- [ ] **Step 3: Commit (`.env.example` only)**

```bash
git add .env.example
git commit -m "chore: add xAI Grok env placeholders"
```

### Task 5: Entities — `ChatConversation` and `ChatMessage`

**Files:**
- Create: `src/modules/ai-chat/entities/chat-conversation.entity.ts`
- Create: `src/modules/ai-chat/entities/chat-message.entity.ts`
- Create: `src/modules/ai-chat/enums/chat-role.enum.ts`

- [ ] **Step 1: Create the role enum**

`src/modules/ai-chat/enums/chat-role.enum.ts`:

```ts
import { registerEnumType } from '@nestjs/graphql';

export enum ChatRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

registerEnumType(ChatRole, { name: 'ChatRole' });
```

- [ ] **Step 2: Create `ChatMessage` entity**

`src/modules/ai-chat/entities/chat-message.entity.ts`:

```ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { ChatRole } from '../enums/chat-role.enum';
import { ChatConversation } from './chat-conversation.entity';

@ObjectType()
@Entity('chat_messages')
@Index(['conversationId', 'createdAt'])
export class ChatMessage {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => ChatRole)
  @Column({ type: 'enum', enum: ChatRole })
  role: ChatRole;

  @Field()
  @Column({ type: 'text' })
  content: string;

  @Column()
  conversationId: string;

  @ManyToOne(() => ChatConversation, (c) => c.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation: ChatConversation;

  @Field()
  @CreateDateColumn()
  createdAt: Date;
}
```

- [ ] **Step 3: Create `ChatConversation` entity**

`src/modules/ai-chat/entities/chat-conversation.entity.ts`:

```ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { User } from '../../users/entities/user.entity';
import { ChatMessage } from './chat-message.entity';

@ObjectType()
@Entity('chat_conversations')
@Index(['userId', 'updatedAt'])
export class ChatConversation {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ default: 'New conversation' })
  title: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Field(() => [ChatMessage])
  @OneToMany(() => ChatMessage, (m) => m.conversation, { cascade: true })
  messages: ChatMessage[];

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/modules/ai-chat/entities src/modules/ai-chat/enums
git commit -m "feat(ai-chat): add ChatConversation and ChatMessage entities"
```

### Task 6: `GrokService` (xAI HTTP client) with full edge-case tests

**Files:**
- Create: `src/modules/ai-chat/grok.service.ts`
- Create: `src/modules/ai-chat/dto/grok.types.ts`
- Test: `src/modules/ai-chat/grok.service.spec.ts`

- [ ] **Step 1: Create the transport types**

`src/modules/ai-chat/dto/grok.types.ts`:

```ts
export interface GrokChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GrokChatResponse {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
}
```

- [ ] **Step 2: Write failing tests**

`src/modules/ai-chat/grok.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException, InternalServerErrorException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { GrokService } from './grok.service';

function makeService(config: Record<string, string>, httpPost: jest.Mock) {
  return Test.createTestingModule({
    providers: [
      GrokService,
      { provide: HttpService, useValue: { post: httpPost } },
      { provide: ConfigService, useValue: { get: (k: string) => config[k] } },
    ],
  }).compile().then((m) => m.get(GrokService));
}

describe('GrokService', () => {
  const baseConfig = {
    XAI_API_KEY: 'test-key',
    XAI_MODEL: 'grok-4',
    XAI_BASE_URL: 'https://api.x.ai/v1',
  };

  it('returns assistant content on success', async () => {
    const post = jest.fn().mockReturnValue(
      of({ data: { choices: [{ message: { content: 'Hello!' } }] } }));
    const svc = await makeService(baseConfig, post);
    const result = await svc.chat([{ role: 'user', content: 'hi' }]);
    expect(result).toBe('Hello!');
    expect(post).toHaveBeenCalledWith(
      'https://api.x.ai/v1/chat/completions',
      expect.objectContaining({ model: 'grok-4', stream: false }),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      }),
    );
  });

  it('throws ServiceUnavailable when API key is missing', async () => {
    const post = jest.fn();
    const svc = await makeService({ ...baseConfig, XAI_API_KEY: '' }, post);
    await expect(svc.chat([{ role: 'user', content: 'hi' }]))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(post).not.toHaveBeenCalled();
  });

  it('throws when response has no choices', async () => {
    const post = jest.fn().mockReturnValue(of({ data: { choices: [] } }));
    const svc = await makeService(baseConfig, post);
    await expect(svc.chat([{ role: 'user', content: 'hi' }]))
      .rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('maps upstream errors to ServiceUnavailable', async () => {
    const post = jest.fn().mockReturnValue(
      throwError(() => ({ message: 'timeout', response: { status: 429 } })));
    const svc = await makeService(baseConfig, post);
    await expect(svc.chat([{ role: 'user', content: 'hi' }]))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('falls back to default model and base url when unset', async () => {
    const post = jest.fn().mockReturnValue(
      of({ data: { choices: [{ message: { content: 'ok' } }] } }));
    const svc = await makeService({ XAI_API_KEY: 'k' }, post);
    await svc.chat([{ role: 'user', content: 'hi' }]);
    expect(post).toHaveBeenCalledWith(
      'https://api.x.ai/v1/chat/completions',
      expect.objectContaining({ model: 'grok-4' }),
      expect.anything(),
    );
  });
});
```

- [ ] **Step 3: Run, verify fail**

Run: `npm test -- grok.service`
Expected: FAIL (`Cannot find module './grok.service'`).

- [ ] **Step 4: Implement `GrokService`**

`src/modules/ai-chat/grok.service.ts`:

```ts
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  InternalServerErrorException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { GrokChatMessage, GrokChatResponse } from './dto/grok.types';

@Injectable()
export class GrokService {
  private readonly logger = new Logger(GrokService.name);
  private readonly DEFAULT_MODEL = 'grok-4';
  private readonly DEFAULT_BASE_URL = 'https://api.x.ai/v1';
  private readonly TIMEOUT_MS = 30000;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async chat(messages: GrokChatMessage[]): Promise<string> {
    const apiKey = this.configService.get<string>('XAI_API_KEY');
    if (!apiKey) {
      this.logger.error('XAI_API_KEY is not configured');
      throw new ServiceUnavailableException('AI service is not configured');
    }

    const model = this.configService.get<string>('XAI_MODEL') || this.DEFAULT_MODEL;
    const baseUrl =
      this.configService.get<string>('XAI_BASE_URL') || this.DEFAULT_BASE_URL;

    try {
      const response = await firstValueFrom(
        this.httpService.post<GrokChatResponse>(
          `${baseUrl}/chat/completions`,
          { model, messages, stream: false },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            timeout: this.TIMEOUT_MS,
          },
        ),
      );

      const content = response.data?.choices?.[0]?.message?.content;
      if (!content) {
        this.logger.error('Grok returned no choices');
        throw new InternalServerErrorException('AI returned an empty response');
      }
      return content;
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      const status = error?.response?.status;
      this.logger.error(
        `Grok request failed (status ${status ?? 'n/a'}): ${error?.message}`,
      );
      throw new ServiceUnavailableException(
        'The AI assistant is temporarily unavailable. Please try again.',
      );
    }
  }
}
```

- [ ] **Step 5: Run, verify pass**

Run: `npm test -- grok.service`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/modules/ai-chat/grok.service.ts src/modules/ai-chat/grok.service.spec.ts src/modules/ai-chat/dto/grok.types.ts
git commit -m "feat(ai-chat): add GrokService xAI client with edge-case handling"
```

### Task 7: `FinanceContextService` (builds the system prompt)

**Files:**
- Create: `src/modules/ai-chat/finance-context.service.ts`
- Test: `src/modules/ai-chat/finance-context.service.spec.ts`

- [ ] **Step 1: Write failing tests**

`src/modules/ai-chat/finance-context.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { FinanceContextService } from './finance-context.service';
import { FinancesService } from '../finances/finances.service';
import { TransactionsService } from '../transactions/transactions.service';
import { BudgetsService } from '../budgets/budgets.service';
import { PotsService } from '../pots/pots.service';
import { Currency } from '../../common/enums/currency.enum';

describe('FinanceContextService', () => {
  let svc: FinanceContextService;

  const finances = { getBalance: jest.fn(), getSpendingByCategory: jest.fn() };
  const transactions = { findAll: jest.fn() };
  const budgets = { findAll: jest.fn() };
  const pots = { findAll: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const m = await Test.createTestingModule({
      providers: [
        FinanceContextService,
        { provide: FinancesService, useValue: finances },
        { provide: TransactionsService, useValue: transactions },
        { provide: BudgetsService, useValue: budgets },
        { provide: PotsService, useValue: pots },
      ],
    }).compile();
    svc = m.get(FinanceContextService);
  });

  it('builds a system prompt containing balance and currency', async () => {
    finances.getBalance.mockResolvedValue({ current: 100, income: 200, expenses: 100, currency: 'USD' });
    finances.getSpendingByCategory.mockResolvedValue([{ category: 'Food', amount: 50 }]);
    transactions.findAll.mockResolvedValue({ transactions: [], totalCount: 0 });
    budgets.findAll.mockResolvedValue([]);
    pots.findAll.mockResolvedValue([]);

    const prompt = await svc.buildSystemPrompt('user-1', Currency.USD);
    expect(prompt).toContain('financial assistant');
    expect(prompt).toContain('100');
    expect(prompt).toContain('USD');
  });

  it('handles a brand-new user with no data without throwing', async () => {
    finances.getBalance.mockResolvedValue({ current: 0, income: 0, expenses: 0, currency: 'USD' });
    finances.getSpendingByCategory.mockResolvedValue([]);
    transactions.findAll.mockResolvedValue({ transactions: [], totalCount: 0 });
    budgets.findAll.mockResolvedValue([]);
    pots.findAll.mockResolvedValue([]);

    const prompt = await svc.buildSystemPrompt('new-user', Currency.USD);
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- finance-context`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `FinanceContextService`**

`src/modules/ai-chat/finance-context.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { FinancesService } from '../finances/finances.service';
import { TransactionsService } from '../transactions/transactions.service';
import { BudgetsService } from '../budgets/budgets.service';
import { PotsService } from '../pots/pots.service';
import { Currency } from '../../common/enums/currency.enum';

@Injectable()
export class FinanceContextService {
  private readonly logger = new Logger(FinanceContextService.name);

  constructor(
    private readonly finances: FinancesService,
    private readonly transactions: TransactionsService,
    private readonly budgets: BudgetsService,
    private readonly pots: PotsService,
  ) {}

  async buildSystemPrompt(userId: string, currency: Currency): Promise<string> {
    try {
      const [balance, spending, recent, budgets, pots] = await Promise.all([
        this.finances.getBalance(userId, currency),
        this.finances.getSpendingByCategory(userId, currency),
        this.transactions.findAll(userId, { take: 10, currency }),
        this.budgets.findAll(userId, currency),
        this.pots.findAll(userId, currency),
      ]);

      const recentLines = recent.transactions
        .map(t => `- ${t.name} (${t.category}): ${t.amount} ${currency}`)
        .join('\n') || '- (none yet)';
      const spendingLines = spending
        .map(s => `- ${s.category}: ${s.amount.toFixed(2)} ${currency}`)
        .join('\n') || '- (none yet)';
      const budgetLines = budgets
        .map(b => `- ${b.category}: max ${b.maximum} ${currency}`)
        .join('\n') || '- (none yet)';
      const potLines = pots
        .map(p => `- ${p.name}: ${p.total}/${p.target} ${currency}`)
        .join('\n') || '- (none yet)';

      return [
        `You are a helpful personal finance assistant inside a budgeting app.`,
        `Answer concisely and only about the user's finances using the data below.`,
        `All amounts are in ${currency}.`,
        ``,
        `Balance: current ${balance.current}, income ${balance.income}, expenses ${balance.expenses}.`,
        ``,
        `Spending by category:\n${spendingLines}`,
        ``,
        `Recent transactions:\n${recentLines}`,
        ``,
        `Budgets:\n${budgetLines}`,
        ``,
        `Savings pots:\n${potLines}`,
        ``,
        `If the user asks something unrelated to their finances, you may answer briefly but steer back to finance topics.`,
      ].join('\n');
    } catch (error) {
      this.logger.error(`Failed to build finance context: ${error?.message}`);
      return `You are a helpful personal finance assistant. The user's financial data could not be loaded right now; answer general finance questions and suggest they retry for personalized insights.`;
    }
  }
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- finance-context`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/ai-chat/finance-context.service.ts src/modules/ai-chat/finance-context.service.spec.ts
git commit -m "feat(ai-chat): add FinanceContextService for system prompt"
```

### Task 8: DTOs + `AiChatService` (orchestration) with edge-case tests

**Files:**
- Create: `src/modules/ai-chat/dto/ai-chat.input.ts`
- Create: `src/modules/ai-chat/ai-chat.service.ts`
- Test: `src/modules/ai-chat/ai-chat.service.spec.ts`

- [ ] **Step 1: Create input DTO**

`src/modules/ai-chat/dto/ai-chat.input.ts`:

```ts
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
```

- [ ] **Step 2: Write failing tests**

`src/modules/ai-chat/ai-chat.service.spec.ts`:

```ts
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
    expect(msgRepo.save).toHaveBeenCalledTimes(2); // user + assistant
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
});
```

- [ ] **Step 3: Run, verify fail**

Run: `npm test -- ai-chat.service`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement `AiChatService`**

`src/modules/ai-chat/ai-chat.service.ts`:

```ts
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
        role: m.role === ChatRole.USER ? ('user' as const) : ('assistant' as const),
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
      throw new ForbiddenException('You do not have access to this conversation');
    }
    return conversation;
  }
}
```

- [ ] **Step 5: Run, verify pass**

Run: `npm test -- ai-chat.service`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/modules/ai-chat/ai-chat.service.ts src/modules/ai-chat/ai-chat.service.spec.ts src/modules/ai-chat/dto/ai-chat.input.ts
git commit -m "feat(ai-chat): add AiChatService orchestration with ownership checks"
```

### Task 9: Resolver + module wiring + service exports

**Files:**
- Create: `src/modules/ai-chat/ai-chat.resolver.ts`
- Create: `src/modules/ai-chat/ai-chat.module.ts`
- Modify: `src/app.module.ts`
- Modify (if needed): `src/modules/finances/finances.module.ts`, `budgets/budgets.module.ts`, `pots/pots.module.ts`, `transactions/transactions.module.ts` to ensure each `exports` its service.

- [ ] **Step 1: Verify each finance module exports its service**

Open each module file and confirm `exports: [XxxService]` is present. `TransactionsModule` already exports `TransactionsService`. Add the export array to `FinancesModule`, `BudgetsModule`, `PotsModule` if missing, e.g. in `finances.module.ts`:

```ts
@Module({
  imports: [TypeOrmModule.forFeature([Transaction]), CommonModule],
  providers: [FinancesService, FinancesResolver],
  exports: [FinancesService],
})
export class FinancesModule {}
```

(Match each module's existing imports/providers; only add/confirm the `exports` line.)

- [ ] **Step 2: Create the resolver**

`src/modules/ai-chat/ai-chat.resolver.ts`:

```ts
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
```

- [ ] **Step 3: Create the module**

`src/modules/ai-chat/ai-chat.module.ts`:

```ts
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
```

- [ ] **Step 4: Register in `app.module.ts`**

Add `import { AiChatModule } from './modules/ai-chat/ai-chat.module';` and add `AiChatModule` to the `imports` array after `FinancesModule`.

- [ ] **Step 5: Build + boot to confirm schema generates**

Run: `npm run build`
Expected: build succeeds (GraphQL schema with `sendChatMessage`, `chatConversations`, `chatConversation`, `deleteChatConversation` generated).

Run: `npm run start:dev` and open `http://localhost:3000/graphql` — confirm the new operations appear in the schema/docs, then stop.

- [ ] **Step 6: Run the full backend test suite**

Run: `npm test`
Expected: all suites PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/ai-chat/ai-chat.resolver.ts src/modules/ai-chat/ai-chat.module.ts src/app.module.ts src/modules/finances/finances.module.ts src/modules/budgets/budgets.module.ts src/modules/pots/pots.module.ts
git commit -m "feat(ai-chat): wire resolver and module into the app"
```

---

## Phase 3 — Frontend AI chat UI

All paths under `personal-finance-app-angular/`.

### Task 10: GraphQL operations + models + service

**Files:**
- Create: `src/app/core/graphql/ai-chat.operations.ts`
- Create: `src/app/core/models/ai-chat.model.ts`
- Create: `src/app/core/service/ai-chat.service.ts`
- Test: `src/app/core/service/ai-chat.service.spec.ts`

- [ ] **Step 1: Create models**

`src/app/core/models/ai-chat.model.ts`:

```ts
export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface ChatConversation {
  id: string;
  title: string;
  messages?: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface SendChatMessageInput {
  conversationId?: string;
  message: string;
}
```

- [ ] **Step 2: Create operations**

`src/app/core/graphql/ai-chat.operations.ts`:

```ts
import { gql } from 'apollo-angular';

export const SEND_CHAT_MESSAGE_MUTATION = gql`
  mutation SendChatMessage($input: SendChatMessageInput!) {
    sendChatMessage(input: $input) {
      id
      role
      content
      createdAt
      conversationId
    }
  }
`;

export const GET_CHAT_CONVERSATIONS_QUERY = gql`
  query ChatConversations {
    chatConversations {
      id
      title
      createdAt
      updatedAt
    }
  }
`;

export const GET_CHAT_CONVERSATION_QUERY = gql`
  query ChatConversation($id: ID!) {
    chatConversation(id: $id) {
      id
      title
      messages {
        id
        role
        content
        createdAt
      }
    }
  }
`;

export const DELETE_CHAT_CONVERSATION_MUTATION = gql`
  mutation DeleteChatConversation($id: ID!) {
    deleteChatConversation(id: $id)
  }
`;
```

Note: add `conversationId` as a `@Field()` on the backend `ChatMessage` entity if you want the frontend to read it directly; otherwise remove `conversationId` from the mutation selection. To expose it, add to `chat-message.entity.ts`: `@Field() ` above the existing `conversationId` column. (Do this small backend edit + rebuild if you keep it in the selection set.)

- [ ] **Step 3: Write a failing service test**

`src/app/core/service/ai-chat.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { Apollo } from 'apollo-angular';
import { of } from 'rxjs';
import { AiChatService } from './ai-chat.service';

describe('AiChatService', () => {
  it('sends a message and returns the assistant reply', (done) => {
    const apollo = {
      mutate: jasmine.createSpy().and.returnValue(
        of({ data: { sendChatMessage: { id: 'm1', role: 'assistant', content: 'hi there', createdAt: '', conversationId: 'c1' } } })),
    };
    TestBed.configureTestingModule({
      providers: [AiChatService, { provide: Apollo, useValue: apollo }],
    });
    const svc = TestBed.inject(AiChatService);
    svc.sendMessage({ message: 'hi' }).subscribe(reply => {
      expect(reply.content).toBe('hi there');
      expect(reply.role).toBe('assistant');
      done();
    });
  });
});
```

- [ ] **Step 4: Run, verify fail**

Run: `npm test -- --watch=false --browsers=ChromeHeadless`
Expected: FAIL (service not found).

- [ ] **Step 5: Implement service**

`src/app/core/service/ai-chat.service.ts`:

```ts
import { Injectable, inject } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  SEND_CHAT_MESSAGE_MUTATION,
  GET_CHAT_CONVERSATIONS_QUERY,
  GET_CHAT_CONVERSATION_QUERY,
  DELETE_CHAT_CONVERSATION_MUTATION,
} from '@/app/core/graphql/ai-chat.operations';
import {
  ChatConversation,
  ChatMessage,
  SendChatMessageInput,
} from '@/app/core/models/ai-chat.model';

@Injectable({ providedIn: 'root' })
export class AiChatService {
  private apollo = inject(Apollo);

  sendMessage(input: SendChatMessageInput): Observable<ChatMessage & { conversationId: string }> {
    return this.apollo
      .mutate<{ sendChatMessage: ChatMessage & { conversationId: string } }>({
        mutation: SEND_CHAT_MESSAGE_MUTATION,
        variables: { input },
      })
      .pipe(map(result => result.data!.sendChatMessage));
  }

  listConversations(): Observable<ChatConversation[]> {
    return this.apollo
      .query<{ chatConversations: ChatConversation[] }>({
        query: GET_CHAT_CONVERSATIONS_QUERY,
        fetchPolicy: 'network-only',
      })
      .pipe(map(result => result.data?.chatConversations ?? []));
  }

  getConversation(id: string): Observable<ChatConversation> {
    return this.apollo
      .query<{ chatConversation: ChatConversation }>({
        query: GET_CHAT_CONVERSATION_QUERY,
        variables: { id },
        fetchPolicy: 'network-only',
      })
      .pipe(map(result => result.data.chatConversation));
  }

  deleteConversation(id: string): Observable<boolean> {
    return this.apollo
      .mutate<{ deleteChatConversation: boolean }>({
        mutation: DELETE_CHAT_CONVERSATION_MUTATION,
        variables: { id },
      })
      .pipe(map(result => !!result.data?.deleteChatConversation));
  }
}
```

- [ ] **Step 6: Run, verify pass**

Run: `npm test -- --watch=false --browsers=ChromeHeadless`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/core/graphql/ai-chat.operations.ts src/app/core/models/ai-chat.model.ts src/app/core/service/ai-chat.service.ts src/app/core/service/ai-chat.service.spec.ts
git commit -m "feat(assistant): add AI chat GraphQL service, operations, models"
```

### Task 11: Assistant page component

**Files:**
- Create: `src/app/pages/assistant/assistant.ts`
- Create: `src/app/pages/assistant/assistant.html`
- Create: `src/app/pages/assistant/assistant.scss`
- Test: `src/app/pages/assistant/assistant.spec.ts`

- [ ] **Step 1: Write a failing component test**

`src/app/pages/assistant/assistant.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Assistant } from './assistant';
import { AiChatService } from '@/app/core/service/ai-chat.service';

describe('Assistant', () => {
  function setup(service: Partial<AiChatService>) {
    TestBed.configureTestingModule({
      imports: [Assistant],
      providers: [{ provide: AiChatService, useValue: service }],
    });
    return TestBed.createComponent(Assistant).componentInstance;
  }

  it('does not send blank messages', () => {
    const sendMessage = jasmine.createSpy();
    const cmp = setup({ sendMessage, listConversations: () => of([]) } as any);
    cmp.draft.set('   ');
    cmp.send();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('appends user and assistant messages on success', () => {
    const cmp = setup({
      listConversations: () => of([]),
      sendMessage: () => of({ id: 'm1', role: 'assistant', content: 'reply', createdAt: '', conversationId: 'c1' }),
    } as any);
    cmp.draft.set('hello');
    cmp.send();
    const roles = cmp.messages().map((m: any) => m.role);
    expect(roles).toEqual(['user', 'assistant']);
    expect(cmp.loading()).toBe(false);
  });

  it('shows an error banner when send fails', () => {
    const cmp = setup({
      listConversations: () => of([]),
      sendMessage: () => throwError(() => new Error('boom')),
    } as any);
    cmp.draft.set('hello');
    cmp.send();
    expect(cmp.error()).toBeTruthy();
    expect(cmp.loading()).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- --watch=false --browsers=ChromeHeadless`
Expected: FAIL (component not found).

- [ ] **Step 3: Implement the component**

`src/app/pages/assistant/assistant.ts`:

```ts
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AiChatService } from '@/app/core/service/ai-chat.service';
import { ChatMessage } from '@/app/core/models/ai-chat.model';

@Component({
  selector: 'app-assistant',
  imports: [FormsModule, TranslateModule],
  templateUrl: './assistant.html',
  styleUrl: './assistant.scss',
})
export class Assistant {
  private aiChat = inject(AiChatService);

  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly draft = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  private conversationId: string | undefined;

  send(): void {
    const text = this.draft().trim();
    if (!text || this.loading()) return;

    this.error.set(null);
    this.loading.set(true);
    this.messages.update(list => [
      ...list,
      { id: `local-${list.length}`, role: 'user', content: text, createdAt: new Date().toISOString() },
    ]);
    this.draft.set('');

    this.aiChat.sendMessage({ conversationId: this.conversationId, message: text }).subscribe({
      next: reply => {
        this.conversationId = reply.conversationId ?? this.conversationId;
        this.messages.update(list => [...list, reply]);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('The assistant is unavailable right now. Please try again.');
        this.loading.set(false);
      },
    });
  }
}
```

- [ ] **Step 4: Implement the template**

`src/app/pages/assistant/assistant.html`:

```html
<section class="assistant">
  <h1 class="assistant__title">{{ 'navigation.assistant' | translate }}</h1>

  <div class="assistant__messages" data-testid="assistant-messages">
    @if (messages().length === 0) {
      <p class="assistant__empty">{{ 'assistant.empty' | translate }}</p>
    }
    @for (message of messages(); track message.id) {
      <div class="assistant__bubble assistant__bubble--{{ message.role }}">
        {{ message.content }}
      </div>
    }
    @if (loading()) {
      <div class="assistant__bubble assistant__bubble--assistant assistant__bubble--typing">…</div>
    }
  </div>

  @if (error()) {
    <p class="assistant__error" role="alert">{{ error() }}</p>
  }

  <form class="assistant__composer" (ngSubmit)="send()">
    <input
      class="assistant__input"
      data-testid="assistant-input"
      [ngModel]="draft()"
      (ngModelChange)="draft.set($event)"
      name="draft"
      [disabled]="loading()"
      [placeholder]="'assistant.placeholder' | translate"
      autocomplete="off"
    />
    <button
      class="assistant__send"
      data-testid="assistant-send"
      type="submit"
      [disabled]="loading() || !draft().trim()"
    >
      {{ 'assistant.send' | translate }}
    </button>
  </form>
</section>
```

- [ ] **Step 5: Implement styles (align with existing SCSS variables)**

`src/app/pages/assistant/assistant.scss`:

```scss
.assistant {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 2rem;
  gap: 1rem;

  &__title { font-size: 2rem; font-weight: 700; }

  &__messages {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    background: #f8f4f0;
    border-radius: 12px;
  }

  &__empty { color: #696868; margin: auto; }

  &__bubble {
    max-width: 70%;
    padding: 0.75rem 1rem;
    border-radius: 12px;
    white-space: pre-wrap;

    &--user { align-self: flex-end; background: hsl(177, 52%, 32%); color: #fff; }
    &--assistant { align-self: flex-start; background: #fff; color: #201f24; }
    &--typing { opacity: 0.6; }
  }

  &__error { color: #c94736; }

  &__composer { display: flex; gap: 0.5rem; }

  &__input {
    flex: 1;
    padding: 0.75rem 1rem;
    border: 1px solid #98908b;
    border-radius: 8px;
  }

  &__send {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 8px;
    background: #201f24;
    color: #fff;
    cursor: pointer;

    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }
}
```

- [ ] **Step 6: Run, verify pass**

Run: `npm test -- --watch=false --browsers=ChromeHeadless`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/assistant
git commit -m "feat(assistant): add AI assistant chat page component"
```

### Task 12: Route + sidebar nav + i18n keys

**Files:**
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/layout/sidebar/helper/configs/tab.config.ts`
- Modify: translation JSON files (find via `public/i18n` or `assets/i18n`)

- [ ] **Step 1: Add the route**

In `app.routes.ts`, add inside the `dashboard` `children` array (after `pots`):

```ts
      {
        path: 'assistant',
        loadComponent: () => import('./pages/assistant/assistant').then(m => m.Assistant)
      },
```

- [ ] **Step 2: Add the sidebar tab**

In `tab.config.ts`, add to the array:

```ts
    {
        id: 5,
        nameKey: 'navigation.assistant',
        icon: 'icon-nav-overview.svg',
        fill: '#b3b3b3',
        fillActive: 'hsl(177, 52%, 32%)',
        route: '/dashboard/assistant'
    },
```

(Reuse an existing icon filename so the SVG resolves; swap for a dedicated AI icon later if desired.)

- [ ] **Step 3: Add i18n keys**

Find the translation files: `Glob` for `**/i18n/*.json`. In each language file add under `navigation` a key `"assistant": "AI Assistant"` (translate per language), and a top-level `"assistant"` block: `{ "empty": "Ask me anything about your finances.", "placeholder": "Type your message…", "send": "Send" }`.

- [ ] **Step 4: Build to confirm route + lazy import resolve**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/app.routes.ts src/app/layout/sidebar/helper/configs/tab.config.ts public
git commit -m "feat(assistant): add route, sidebar nav, and i18n keys"
```

---

## Phase 4 — Playwright view tests

All paths under `personal-finance-app-angular/`.

### Task 13: Install + configure Playwright

**Files:**
- Modify: `package.json`
- Create: `playwright.config.ts`
- Create: `e2e/` directory

- [ ] **Step 1: Install Playwright**

Run: `npm install -D @playwright/test` then `npx playwright install chromium`
Expected: installs without error.

- [ ] **Step 2: Create config with auto-started web server**

`playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```

- [ ] **Step 3: Add scripts**

In `package.json` `scripts`, add:

```json
    "e2e": "playwright test",
    "e2e:ui": "playwright test --ui"
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json playwright.config.ts
git commit -m "chore(e2e): add Playwright config and scripts"
```

### Task 14: E2E — registration → overview renders (bug regression)

**Files:**
- Create: `e2e/register-overview.spec.ts`

**Precondition:** backend running (`npm run start:dev` in the backend repo) with a working Postgres DB, since registration hits GraphQL.

- [ ] **Step 1: Write the test**

`e2e/register-overview.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('new user lands on a working overview page', async ({ page }) => {
  const email = `e2e_${Date.now()}@example.com`;
  const errors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto('/auth/register');
  await page.getByLabel(/name/i).fill('E2E User');
  await page.getByLabel(/email/i).fill(email);
  // Two password fields: fill both
  const passwords = page.locator('input[type="password"]');
  await passwords.nth(0).fill('secret123');
  await passwords.nth(1).fill('secret123');
  await page.getByRole('button', { name: /create account|sign up|register/i }).click();

  await expect(page).toHaveURL(/dashboard\/overview/, { timeout: 15_000 });
  // Overview must not be stuck loading and must not have thrown
  await expect(page.locator('app-overview')).toBeVisible();
  expect(errors.join('\n')).not.toContain('TypeError');
});
```

Note: adjust selectors (`getByLabel`, button name) to match the real register form markup — open `auth-register.html` and use the actual labels/ids/placeholder text. Keep the console-error assertion; it is the core regression guard.

- [ ] **Step 2: Run the test**

Run: `npm run e2e -- register-overview`
Expected: PASS. If it fails on selectors, fix selectors (not the assertion) and re-run.

- [ ] **Step 3: Commit**

```bash
git add e2e/register-overview.spec.ts
git commit -m "test(e2e): regression test for overview after registration"
```

### Task 15: E2E — AI assistant send/receive

**Files:**
- Create: `e2e/assistant.spec.ts`

- [ ] **Step 1: Write the test (mocks the GraphQL response for determinism)**

`e2e/assistant.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('assistant shows user message and AI reply', async ({ page }) => {
  // Seed auth so the route guard passes (token presence is what the guard checks).
  await page.addInitScript(() => localStorage.setItem('token', 'e2e-fake-token'));

  // Stub the GraphQL endpoint: return a user for `me`, and an assistant reply for sendChatMessage.
  await page.route('**/graphql', async route => {
    const body = route.request().postDataJSON();
    const op = body?.operationName;
    if (op === 'Me') {
      return route.fulfill({ json: { data: { me: { id: 'u1', email: 'e2e@x.com', name: 'E2E', currency: 'USD' } } } });
    }
    if (op === 'SendChatMessage') {
      return route.fulfill({ json: { data: { sendChatMessage: {
        id: 'm1', role: 'assistant', content: 'You spent 50 USD on Food.', createdAt: '', conversationId: 'c1',
      } } } });
    }
    return route.fulfill({ json: { data: {} } });
  });

  await page.goto('/dashboard/assistant');
  await page.getByTestId('assistant-input').fill('How much did I spend on food?');
  await page.getByTestId('assistant-send').click();

  await expect(page.getByTestId('assistant-messages')).toContainText('How much did I spend on food?');
  await expect(page.getByTestId('assistant-messages')).toContainText('You spent 50 USD on Food.');
});
```

- [ ] **Step 2: Run the test**

Run: `npm run e2e -- assistant`
Expected: PASS. (If the auth guard redirects, confirm what the guard reads from storage and adjust the seeded value/key accordingly — see `core/guards/auth.guard.ts`.)

- [ ] **Step 3: Commit**

```bash
git add e2e/assistant.spec.ts
git commit -m "test(e2e): assistant send/receive flow"
```

### Task 16: Final verification sweep

- [ ] **Step 1: Backend full suite**

Run (backend): `npm test`
Expected: all PASS.

- [ ] **Step 2: Frontend unit suite**

Run (frontend): `npm test -- --watch=false --browsers=ChromeHeadless`
Expected: all PASS.

- [ ] **Step 3: Frontend e2e suite**

Run (frontend, backend running): `npm run e2e`
Expected: all PASS.

- [ ] **Step 4: Manual smoke with a real key**

With the real `XAI_API_KEY` in backend `.env`, register a user, open `/dashboard/assistant`, ask "How much did I spend this month?", and confirm a real Grok reply renders.

- [ ] **Step 5: Final commit / done**

Use `superpowers:finishing-a-development-branch` to decide on merge/PR.

---

## Notes for the implementer

- **Never commit the real `XAI_API_KEY`.** Only `.env.example` placeholders are committed.
- Backend uses Jest (`*.spec.ts`), frontend uses Karma/Jasmine (`*.spec.ts`) — do not mix matchers.
- Path alias `@/` maps to `src/` in the Angular app (used throughout existing code).
- `synchronize: true` in dev means the new `chat_conversations` / `chat_messages` tables auto-create on boot; no migration needed for local dev.
- If `getByLabel`/role selectors in Playwright don't match, open the real templates and adjust selectors — keep the assertions.
