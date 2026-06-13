# Grok AI Chat + First-Page Bug Fix + Playwright + Refactor — Design

Date: 2026-06-13
Scope: `personal-finance-service` (NestJS/GraphQL backend) and `personal-finance-app-angular` (Angular 20 frontend)

## Goal

1. Integrate a **finance-aware AI chat** powered by the xAI **Grok** API.
2. Persist conversations/messages in PostgreSQL.
3. Fix the bug where the **first page (Overview) is broken right after creating a new account**.
4. Add **Playwright** for view/E2E testing.
5. Refactor/harden bad code encountered along the way (scoped only to what we touch).

Decisions locked with the user:
- Chat is **finance-aware** (reads balance, transactions, budgets, pots to answer personalized questions).
- Responses are **non-streaming, persisted** (GraphQL mutation; history saved in Postgres).
- API key lives in backend **`.env`** as `XAI_API_KEY` (gitignored); placeholder added to `.env.example`. Never hardcode/commit the real key.
- Chat UI is a **dedicated route `/dashboard/assistant`** in the sidebar (not a floating widget).

## xAI / Grok API facts (verified via docs)

- Endpoint: `POST https://api.x.ai/v1/chat/completions`
- Auth header: `Authorization: Bearer $XAI_API_KEY`
- OpenAI-compatible body: `{ model, messages: [{role, content}], stream }`
- Response: `choices[0].message.content`; `usage` token counts included.
- Model configurable; default `grok-4`.

## A. Backend — new module `src/modules/ai-chat/`

Mirrors the existing 3-layer GraphQL pattern (resolver → service → entity) and the
`ExchangeRatesService` HTTP pattern (`HttpService`, `firstValueFrom`, timeout, `Logger`, error handling).

### Entities
- `ChatConversation`: `id` (uuid), `userId` (FK → User, `onDelete: CASCADE`), `title`, `createdAt`, `updatedAt`, `messages: ChatMessage[]`.
- `ChatMessage`: `id` (uuid), `conversationId` (FK → ChatConversation, CASCADE), `role` (enum `user`|`assistant`), `content` (text), `createdAt`.

### Services
- `GrokService` — wraps `HttpService`; POSTs to `${XAI_BASE_URL}/chat/completions` with bearer auth; reads `XAI_API_KEY`, `XAI_MODEL` (default `grok-4`), `XAI_BASE_URL` (default `https://api.x.ai/v1`) via `ConfigService`. Timeout (e.g. 30s). Returns assistant content. Throws typed errors on failure.
- `FinanceContextService` — gathers the user's balance, recent transactions, budgets, pots (reusing existing services) and builds a concise **system prompt** containing that context.
- `AiChatService` — orchestration: resolve/create conversation (with **ownership check**), persist user message, assemble `[system, ...history, user]`, call `GrokService`, persist assistant reply, return it.

### Resolver (all guarded by `GqlAuthGuard` + `@CurrentUser`)
- `sendChatMessage(input: { conversationId?: ID, message: String })` → assistant `ChatMessage` (+ conversation id/title).
- `chatConversations` → caller's conversations.
- `chatConversation(id)` → messages for one owned conversation.
- `deleteChatConversation(id)` → boolean.

### DTOs
- `SendChatMessageInput` (`@InputType`) with `@IsNotEmpty`, `@MaxLength` on `message`; optional `conversationId`.
- Response object types as needed.

### Config / wiring
- Add `XAI_API_KEY`, `XAI_MODEL=grok-4`, `XAI_BASE_URL=https://api.x.ai/v1` to `.env.example`.
- `AiChatModule` imports `HttpModule`, `TypeOrmModule.forFeature([ChatConversation, ChatMessage])`, and the finance modules needed for context; register in `app.module.ts`.

### Edge cases (Jest unit tests, HTTP mocked)
Missing/invalid `XAI_API_KEY`; xAI timeout / 429 / 5xx; empty or whitespace-only message; over-length message; conversation not found; conversation not owned by caller (forbidden); malformed xAI response (no `choices`); brand-new user with no financial data; unauthenticated request.

## B. Frontend — chat UI (Angular 20 standalone, signals)

- New: `core/graphql/ai-chat.operations.ts`, `core/models/ai-chat.model.ts`, `core/service/ai-chat.service.ts` (Apollo mutations/queries).
- New page at route `/dashboard/assistant`, added to the sidebar nav. Reuses existing reusable components and SCSS variables (Public Sans, existing palette).
- Signal state: `messages`, `loading`, `conversations`. Edge cases: disabled send while loading, error banner, empty state, Enter-to-send.

## C. Fix first-page-after-register bug

Approach: **reproduce first** (`systematic-debugging`) using the dev server + Playwright, confirm root cause, then fix via TDD.

Leading hypotheses from code review:
1. **Currency timing race** — `Overview.ngOnInit` calls `loadOverviewData(this.api.currency())`, but the `Api` constructor `effect` syncing the just-registered user's currency may not have run yet → loads with stale `'USD'`.
2. **Fragile null handling** — in `Api.loadOverviewData`, `data.transactions.transactions` is dereferenced inside `.subscribe` (after the `catchError` operator); for a new account a null field throws an *uncaught* error, leaving `_loading` stuck `true` → broken page.

Confirm before changing.

## D. Playwright

Install `@playwright/test`; add `playwright.config.ts` with a `webServer` block that auto-starts the Angular app; `e2e/` folder; `npm run e2e` script. Tests: register → overview renders (regression for bug C); AI chat send/receive; smoke navigation.

## E. Refactor (scoped)

`api.ts`: dedupe the repeated `query/catch/subscribe` boilerplate and harden null handling in `loadOverviewData` (directly supports fix C). No unrelated refactoring.

## Process

`subagent-driven-development`. Workstreams A (backend), B (frontend UI), and D-scaffolding are largely independent and parallelizable; C starts with investigation; all use TDD; Playwright validates views at the end.

## Out of scope (YAGNI)

Streaming responses; tool-calling/agentic actions; multi-model selection UI; conversation sharing/export.
