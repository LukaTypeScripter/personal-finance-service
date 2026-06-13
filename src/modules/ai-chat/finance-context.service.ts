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

      const recentLines =
        recent.transactions
          .map((t) => `- ${t.name} (${t.category}): ${t.amount} ${currency}`)
          .join('\n') || '- (none yet)';
      const spendingLines =
        spending
          .map((s) => `- ${s.category}: ${s.amount.toFixed(2)} ${currency}`)
          .join('\n') || '- (none yet)';
      const budgetLines =
        budgets
          .map((b) => `- ${b.category}: max ${b.maximum} ${currency}`)
          .join('\n') || '- (none yet)';
      const potLines =
        pots
          .map((p) => `- ${p.name}: ${p.total}/${p.target} ${currency}`)
          .join('\n') || '- (none yet)';

      return [
        `You are a helpful personal financial assistant inside a budgeting app.`,
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
