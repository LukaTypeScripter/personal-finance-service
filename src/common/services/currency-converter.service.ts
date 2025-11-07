import { Injectable, Logger, Optional } from '@nestjs/common';
import { Currency } from '../enums/currency.enum';
import { ExchangeRatesService } from '../../modules/exchange-rates/exchange-rates.service';

@Injectable()
export class CurrencyConverterService {
  private readonly logger = new Logger(CurrencyConverterService.name);

  private readonly fallbackRates = {
    USD_TO_GEO: 2.7,
    GEO_TO_USD: 0.37,
    EUR_TO_GEO: 3.12,
    GEO_TO_EUR: 0.32,
    USD_TO_EUR: 1.15,
    EUR_TO_USD: 0.87,
  };

  constructor(
    @Optional() private readonly exchangeRatesService?: ExchangeRatesService,
  ) {}

  /**
   * Convert amount from one currency to another
   * @param amount - The amount to convert
   * @param fromCurrency - Source currency
   * @param toCurrency - Target currency
   * @returns Converted amount
   */
  async convertCurrency(
    amount: number,
    fromCurrency: Currency,
    toCurrency: Currency,
  ): Promise<number> {
    if (fromCurrency === toCurrency) {
      return amount;
    }

    const rate = await this.getExchangeRate(fromCurrency, toCurrency);

    return amount * rate;
  }

  /**
   * Get exchange rate between two currencies
   * @param fromCurrency - Source currency
   * @param toCurrency - Target currency
   * @returns Exchange rate
   */
  async getExchangeRate(
    fromCurrency: Currency,
    toCurrency: Currency,
  ): Promise<number> {
    if (fromCurrency === toCurrency) {
      return 1;
    }

    if (this.exchangeRatesService) {
      try {
        const rate = await this.exchangeRatesService.getRate(
          fromCurrency,
          toCurrency,
        );

        if (rate !== null) {
          return rate;
        }

        this.logger.warn(
          `API returned null rate for ${fromCurrency} to ${toCurrency}, using fallback`,
        );
      } catch (error) {
        this.logger.error(
          `Error fetching rate from API: ${error.message}, using fallback`,
        );
      }
    }

    // Fallback to hardcoded rates
    return this.getFallbackRate(fromCurrency, toCurrency);
  }

  /**
   * Get fallback exchange rate from hardcoded values
   * @param fromCurrency - Source currency
   * @param toCurrency - Target currency
   * @returns Exchange rate
   */
  private getFallbackRate(fromCurrency: Currency, toCurrency: Currency): number {
    const key = `${fromCurrency}_TO_${toCurrency}`;
    const rate = this.fallbackRates[key];

    if (rate) {
      return rate;
    }

    // Try inverse rate
    const inverseKey = `${toCurrency}_TO_${fromCurrency}`;
    const inverseRate = this.fallbackRates[inverseKey];

    if (inverseRate) {
      return 1 / inverseRate;
    }

    // Try cross-conversion via USD or GEO
    const crossRate = this.findCrossFallbackRate(fromCurrency, toCurrency);
    if (crossRate !== null) {
      return crossRate;
    }

    this.logger.warn(
      `No fallback rate found for ${fromCurrency} to ${toCurrency}, returning 1`,
    );
    return 1;
  }

  /**
   * Attempts to find a cross-conversion rate using an intermediate currency
   * @param from - Source currency
   * @param to - Target currency
   * @returns Cross rate or null
   */
  private findCrossFallbackRate(from: Currency, to: Currency): number | null {
    const intermediates = [Currency.USD, Currency.GEO, Currency.EUR];

    for (const intermediate of intermediates) {
      if (intermediate === from || intermediate === to) continue;

      const fromToIntermediate = this.fallbackRates[`${from}_TO_${intermediate}`];
      const intermediateToTo = this.fallbackRates[`${intermediate}_TO_${to}`];

      if (fromToIntermediate && intermediateToTo) {
        return fromToIntermediate * intermediateToTo;
      }
    }

    return null;
  }
}
