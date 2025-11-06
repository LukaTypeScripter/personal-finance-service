import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Balance } from './models/balance.model';
import { Currency } from '../../common/enums/currency.enum';

@Injectable()
export class FinancesService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
  ) {}

  async getBalance(userId: string, currency: Currency): Promise<Balance> {
    const transactions = await this.transactionRepository.find({
      where: { userId },
    });

    let income = 0;
    let expenses = 0;

    for (const transaction of transactions) {
      const convertedAmount = await this.convertCurrency(
        Number(transaction.amount),
        transaction.currency,
        currency,
      );

      if (transaction.amount > 0) {
        income += convertedAmount;
      } else {
        expenses += Math.abs(convertedAmount);
      }
    }

    return {
      current: income - expenses,
      income,
      expenses,
      currency,
    };
  }

  async getBudgetSpending(
    userId: string,
    category: string,
    currency: Currency,
  ): Promise<number> {
    const transactions = await this.transactionRepository.find({
      where: { userId, category },
    });

    let total = 0;

    for (const transaction of transactions) {
      if (transaction.amount < 0) {
        const convertedAmount = await this.convertCurrency(
          Math.abs(Number(transaction.amount)),
          transaction.currency,
          currency,
        );
        total += convertedAmount;
      }
    }

    return total;
  }

  private async convertCurrency(
    amount: number,
    fromCurrency: Currency,
    toCurrency: Currency,
  ): Promise<number> {
    if (fromCurrency === toCurrency) {
      return amount;
    }

    // Exchange rates (you can fetch from external API in production)
    const rates = {
      USD_TO_GEO: 2.7, // 1 USD = 2.7 GEO (example rate)
      GEO_TO_USD: 0.37, // 1 GEO = 0.37 USD
    };

    if (fromCurrency === Currency.USD && toCurrency === Currency.GEO) {
      return amount * rates.USD_TO_GEO;
    } else if (fromCurrency === Currency.GEO && toCurrency === Currency.USD) {
      return amount * rates.GEO_TO_USD;
    }

    return amount;
  }

  // Helper method to get exchange rate
  async getExchangeRate(
    fromCurrency: Currency,
    toCurrency: Currency,
  ): Promise<number> {
    if (fromCurrency === toCurrency) {
      return 1;
    }

    const rates = {
      USD_TO_GEO: 2.7,
      GEO_TO_USD: 0.37,
    };

    if (fromCurrency === Currency.USD && toCurrency === Currency.GEO) {
      return rates.USD_TO_GEO;
    } else if (fromCurrency === Currency.GEO && toCurrency === Currency.USD) {
      return rates.GEO_TO_USD;
    }

    return 1;
  }

  // Get spending by category
  async getSpendingByCategory(
    userId: string,
    currency: Currency,
  ): Promise<Array<{ category: string; amount: number }>> {
    const transactions = await this.transactionRepository.find({
      where: { userId },
    });

    const categoryMap = new Map<string, number>();

    for (const transaction of transactions) {
      if (transaction.amount < 0) {
        const convertedAmount = await this.convertCurrency(
          Math.abs(Number(transaction.amount)),
          transaction.currency,
          currency,
        );

        const currentAmount = categoryMap.get(transaction.category) || 0;
        categoryMap.set(transaction.category, currentAmount + convertedAmount);
      }
    }

    return Array.from(categoryMap.entries()).map(([category, amount]) => ({
      category,
      amount,
    }));
  }
}
