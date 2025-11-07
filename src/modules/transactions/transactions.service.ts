import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between, MoreThanOrEqual, LessThanOrEqual, Like } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import {
  CreateTransactionInput,
  UpdateTransactionInput,
  FilterTransactionsInput,
  SortTransactionsInput,
  TransactionSortField,
  SortOrder,
} from './dto/transaction.input';
import { Currency } from '../../common/enums/currency.enum';
import { CurrencyConverterService } from '../../common/services/currency-converter.service';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private currencyConverter: CurrencyConverterService,
  ) {}

  async create(
    userId: string,
    input: CreateTransactionInput,
    userCurrency: Currency,
  ): Promise<Transaction> {
    const transaction = this.transactionRepository.create({
      ...input,
      userId,
      currency: input.currency || userCurrency,
      date: new Date(input.date),
    });

    return await this.transactionRepository.save(transaction);
  }

  async findAll(
    userId: string,
    options?: {
      skip?: number;
      take?: number;
      filter?: FilterTransactionsInput;
      sort?: SortTransactionsInput;
      currency?: Currency;
    },
  ): Promise<{ transactions: Transaction[]; totalCount: number; skip: number; take: number }> {
    const where: FindOptionsWhere<Transaction> = { userId };

    // Apply filters
    if (options?.filter) {
      const filter = options.filter;

      // Name filter (partial match)
      if (filter.name) {
        where.name = Like(`%${filter.name}%`);
      }

      // Category filter (exact match)
      if (filter.category) {
        where.category = filter.category;
      }

      // Currency filter
      if (filter.currency) {
        where.currency = filter.currency;
      }

      // Recurring filter
      if (filter.recurring !== undefined) {
        where.recurring = filter.recurring;
      }

      // Amount range filter
      if (filter.minAmount !== undefined && filter.maxAmount !== undefined) {
        where.amount = Between(filter.minAmount, filter.maxAmount);
      } else if (filter.minAmount !== undefined) {
        where.amount = MoreThanOrEqual(filter.minAmount);
      } else if (filter.maxAmount !== undefined) {
        where.amount = LessThanOrEqual(filter.maxAmount);
      }

      // Date range filter
      if (filter.startDate && filter.endDate) {
        where.date = Between(new Date(filter.startDate), new Date(filter.endDate));
      } else if (filter.startDate) {
        where.date = MoreThanOrEqual(new Date(filter.startDate));
      } else if (filter.endDate) {
        where.date = LessThanOrEqual(new Date(filter.endDate));
      }
    }

    // Apply sorting
    const sortBy = options?.sort?.sortBy || TransactionSortField.DATE;
    const sortOrder = options?.sort?.sortOrder || SortOrder.DESC;

    const order: any = {};
    order[sortBy] = sortOrder;

    const skip = options?.skip || 0;
    const take = options?.take || 50;

    const [transactions, totalCount] = await this.transactionRepository.findAndCount({
      where,
      skip,
      take,
      order,
    });

    if (options?.currency) {
      const convertedTransactions = await Promise.all(
        transactions.map(transaction =>
          this.convertTransactionCurrency(transaction, options.currency!)
        )
      );
      return { transactions: convertedTransactions, totalCount, skip, take };
    }

    return { transactions, totalCount, skip, take };
  }

  async findOne(id: string, userId: string, currency?: Currency): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id, userId },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    if (currency) {
      return await this.convertTransactionCurrency(transaction, currency);
    }

    return transaction;
  }

  async update(
    id: string,
    userId: string,
    input: UpdateTransactionInput,
  ): Promise<Transaction> {
    const transaction = await this.findOne(id, userId);

    const updateData: any = { ...input };
    if (input.date) {
      updateData.date = new Date(input.date);
    }

    Object.assign(transaction, updateData);

    return await this.transactionRepository.save(transaction);
  }

  async remove(id: string, userId: string): Promise<boolean> {
    const transaction = await this.findOne(id, userId);
    await this.transactionRepository.remove(transaction);
    return true;
  }

  async getRecurringTransactions(userId: string, currency?: Currency): Promise<Transaction[]> {
    const transactions = await this.transactionRepository.find({
      where: { userId, recurring: true },
      order: { date: 'DESC' },
    });

    if (currency) {
      return Promise.all(
        transactions.map(transaction =>
          this.convertTransactionCurrency(transaction, currency)
        )
      );
    }

    return transactions;
  }

  async getTransactionsByCategory(
    userId: string,
    category: string,
    currency?: Currency,
  ): Promise<Transaction[]> {
    const transactions = await this.transactionRepository.find({
      where: { userId, category },
      order: { date: 'DESC' },
    });

    if (currency) {
      return Promise.all(
        transactions.map(transaction =>
          this.convertTransactionCurrency(transaction, currency)
        )
      );
    }

    return transactions;
  }

  /**
   * Convert transaction amount to target currency
   */
  private async convertTransactionCurrency(transaction: Transaction, targetCurrency: Currency): Promise<Transaction> {
    const convertedTransaction = { ...transaction };

    convertedTransaction.amount = await this.currencyConverter.convertCurrency(
      Number(transaction.amount),
      transaction.currency,
      targetCurrency,
    );

    // Update the currency field to reflect the conversion
    convertedTransaction.currency = targetCurrency;

    return convertedTransaction;
  }
}
