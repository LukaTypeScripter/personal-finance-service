import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Balance } from './models/balance.model';
import { Currency } from '../../common/enums/currency.enum';
import { CurrencyConverterService } from '../../common/services/currency-converter.service';

@Injectable()
export class FinancesService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private currencyConverter: CurrencyConverterService,
  ) {}

  async getBalance(userId: string, currency: Currency): Promise<Balance> {
    const transactions = await this.transactionRepository.find({
      where: { userId },
    });

    let income = 0;
    let expenses = 0;

    for (const transaction of transactions) {
      const convertedAmount = this.currencyConverter.convertCurrency(
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
        const convertedAmount = this.currencyConverter.convertCurrency(
          Math.abs(Number(transaction.amount)),
          transaction.currency,
          currency,
        );
        total += convertedAmount;
      }
    }

    return total;
  }

  // Helper method to get exchange rate
  async getExchangeRate(
    fromCurrency: Currency,
    toCurrency: Currency,
  ): Promise<number> {
    return this.currencyConverter.getExchangeRate(fromCurrency, toCurrency);
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
        const convertedAmount = this.currencyConverter.convertCurrency(
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
