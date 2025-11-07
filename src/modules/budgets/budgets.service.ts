import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Budget } from './entities/budget.entity';
import { CreateBudgetInput, UpdateBudgetInput } from './dto/budget.input';
import { Currency } from '../../common/enums/currency.enum';
import { CurrencyConverterService } from '../../common/services/currency-converter.service';

@Injectable()
export class BudgetsService {
  constructor(
    @InjectRepository(Budget)
    private budgetRepository: Repository<Budget>,
    private currencyConverter: CurrencyConverterService,
  ) {}

  async create(
    userId: string,
    input: CreateBudgetInput,
    userCurrency: Currency,
  ): Promise<Budget> {
    // Check if budget already exists for this category
    const existingBudget = await this.budgetRepository.findOne({
      where: { userId, category: input.category },
    });

    if (existingBudget) {
      throw new ConflictException(
        `Budget for category "${input.category}" already exists`,
      );
    }

    const budget = this.budgetRepository.create({
      ...input,
      userId,
      currency: input.currency || userCurrency,
    });

    return await this.budgetRepository.save(budget);
  }

  async findAll(userId: string, currency?: Currency): Promise<Budget[]> {
    const budgets = await this.budgetRepository.find({
      where: { userId },
      order: { category: 'ASC' },
    });

    if (currency) {
      return budgets.map((budget) =>
        this.convertBudgetCurrency(budget, currency),
      );
    }

    return budgets;
  }

  async findOne(
    id: string,
    userId: string,
    currency?: Currency,
  ): Promise<Budget> {
    const budget = await this.budgetRepository.findOne({
      where: { id, userId },
    });

    if (!budget) {
      throw new NotFoundException(`Budget with ID ${id} not found`);
    }

    if (currency) {
      return this.convertBudgetCurrency(budget, currency);
    }

    return budget;
  }

  async findByCategory(
    userId: string,
    category: string,
    currency?: Currency,
  ): Promise<Budget> {
    const budget = await this.budgetRepository.findOne({
      where: { userId, category },
    });

    if (!budget) {
      throw new NotFoundException(
        `Budget for category "${category}" not found`,
      );
    }

    if (currency) {
      return this.convertBudgetCurrency(budget, currency);
    }

    return budget;
  }

  async update(
    id: string,
    userId: string,
    input: UpdateBudgetInput,
  ): Promise<Budget> {
    const budget = await this.findOne(id, userId);
    Object.assign(budget, input);
    return await this.budgetRepository.save(budget);
  }

  async remove(id: string, userId: string): Promise<boolean> {
    const budget = await this.findOne(id, userId);
    await this.budgetRepository.remove(budget);
    return true;
  }

  /**
   * Convert budget amounts to target currency
   */
  private convertBudgetCurrency(
    budget: Budget,
    targetCurrency: Currency,
  ): Budget {
    const convertedBudget = { ...budget };

    convertedBudget.maximum = this.currencyConverter.convertCurrency(
      Number(budget.maximum),
      budget.currency,
      targetCurrency,
    );

    // Update the currency field to reflect the conversion
    convertedBudget.currency = targetCurrency;

    return convertedBudget;
  }
}
