import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Budget } from './entities/budget.entity';
import { CreateBudgetInput, UpdateBudgetInput } from './dto/budget.input';
import { Currency } from '../../common/enums/currency.enum';

@Injectable()
export class BudgetsService {
  constructor(
    @InjectRepository(Budget)
    private budgetRepository: Repository<Budget>,
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

  async findAll(userId: string): Promise<Budget[]> {
    return await this.budgetRepository.find({
      where: { userId },
      order: { category: 'ASC' },
    });
  }

  async findOne(id: string, userId: string): Promise<Budget> {
    const budget = await this.budgetRepository.findOne({
      where: { id, userId },
    });

    if (!budget) {
      throw new NotFoundException(`Budget with ID ${id} not found`);
    }

    return budget;
  }

  async findByCategory(userId: string, category: string): Promise<Budget> {
    const budget = await this.budgetRepository.findOne({
      where: { userId, category },
    });

    if (!budget) {
      throw new NotFoundException(`Budget for category "${category}" not found`);
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
}
