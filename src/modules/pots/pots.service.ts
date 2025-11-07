import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pot } from './entities/pot.entity';
import { CreatePotInput, UpdatePotInput } from './dto/pot.input';
import { Currency } from '../../common/enums/currency.enum';
import { CurrencyConverterService } from '../../common/services/currency-converter.service';

@Injectable()
export class PotsService {
  constructor(
    @InjectRepository(Pot)
    private potRepository: Repository<Pot>,
    private currencyConverter: CurrencyConverterService,
  ) {}

  async create(
    userId: string,
    input: CreatePotInput,
    userCurrency: Currency,
  ): Promise<Pot> {
    const pot = this.potRepository.create({
      ...input,
      userId,
      currency: input.currency || userCurrency,
      total: input.total || 0,
    });

    return await this.potRepository.save(pot);
  }

  async findAll(userId: string, currency?: Currency): Promise<Pot[]> {
    const pots = await this.potRepository.find({
      where: { userId },
      order: { name: 'ASC' },
    });

    if (currency) {
      return Promise.all(
        pots.map(pot => this.convertPotCurrency(pot, currency))
      );
    }

    return pots;
  }

  async findOne(id: string, userId: string, currency?: Currency): Promise<Pot> {
    const pot = await this.potRepository.findOne({
      where: { id, userId },
    });

    if (!pot) {
      throw new NotFoundException(`Pot with ID ${id} not found`);
    }

    if (currency) {
      return await this.convertPotCurrency(pot, currency);
    }

    return pot;
  }

  async update(
    id: string,
    userId: string,
    input: UpdatePotInput,
  ): Promise<Pot> {
    const pot = await this.findOne(id, userId);
    Object.assign(pot, input);
    return await this.potRepository.save(pot);
  }

  async addMoney(
    id: string,
    userId: string,
    amount: number,
  ): Promise<Pot> {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    const pot = await this.findOne(id, userId);
    pot.total = Number(pot.total) + amount;

    if (pot.total > pot.target) {
      throw new BadRequestException('Total cannot exceed target');
    }

    return await this.potRepository.save(pot);
  }

  async withdrawMoney(
    id: string,
    userId: string,
    amount: number,
  ): Promise<Pot> {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    const pot = await this.findOne(id, userId);

    if (Number(pot.total) < amount) {
      throw new BadRequestException('Insufficient funds in pot');
    }

    pot.total = Number(pot.total) - amount;
    return await this.potRepository.save(pot);
  }

  async remove(id: string, userId: string): Promise<boolean> {
    const pot = await this.findOne(id, userId);
    await this.potRepository.remove(pot);
    return true;
  }

  /**
   * Convert pot amounts to target currency
   */
  private async convertPotCurrency(pot: Pot, targetCurrency: Currency): Promise<Pot> {
    const convertedPot = { ...pot };

    convertedPot.target = await this.currencyConverter.convertCurrency(
      Number(pot.target),
      pot.currency,
      targetCurrency,
    );

    convertedPot.total = await this.currencyConverter.convertCurrency(
      Number(pot.total),
      pot.currency,
      targetCurrency,
    );

    // Update the currency field to reflect the conversion
    convertedPot.currency = targetCurrency;

    return convertedPot;
  }
}
