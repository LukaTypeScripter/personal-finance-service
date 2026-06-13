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
