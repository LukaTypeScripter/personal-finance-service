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

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
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
    },
  ): Promise<Transaction[]> {
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

    return await this.transactionRepository.find({
      where,
      skip: options?.skip || 0,
      take: options?.take || 50,
      order,
    });
  }

  async findOne(id: string, userId: string): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id, userId },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
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

  async getRecurringTransactions(userId: string): Promise<Transaction[]> {
    return await this.transactionRepository.find({
      where: { userId, recurring: true },
      order: { date: 'DESC' },
    });
  }

  async getTransactionsByCategory(
    userId: string,
    category: string,
  ): Promise<Transaction[]> {
    return await this.transactionRepository.find({
      where: { userId, category },
      order: { date: 'DESC' },
    });
  }
}
