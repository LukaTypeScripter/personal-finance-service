import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ExchangeRateDto } from './dto/exchange-rate.dto';

@Injectable()
export class ExchangeRatesService {
  private readonly logger = new Logger(ExchangeRatesService.name);
  private readonly API_URL = 'https://api.kursi.ge:8080/api/public/currencies';
  private readonly CACHE_TTL = 3600000; // 1 hour in milliseconds

  private cachedRates: ExchangeRateDto[] = [];
  private lastFetchTime: number = 0;

  constructor(private readonly httpService: HttpService) {}

  /**
   * Fetches exchange rates from kursi.ge API with caching
   * @returns Array of exchange rates
   */
  async getExchangeRates(): Promise<ExchangeRateDto[]> {
    const now = Date.now();
    const cacheAge = now - this.lastFetchTime;

    if (this.cachedRates.length > 0 && cacheAge < this.CACHE_TTL) {
      this.logger.debug(
        `Returning cached rates (age: ${Math.round(cacheAge / 1000)}s)`,
      );
      return this.cachedRates;
    }

    try {
      this.logger.log('Fetching fresh exchange rates from API...');
      const response = await firstValueFrom(
        this.httpService.get<ExchangeRateDto[]>(this.API_URL, {
          timeout: 5000,
        }),
      );

      this.cachedRates = response.data;
      this.lastFetchTime = now;
      this.logger.log(
        `Successfully fetched ${this.cachedRates.length} exchange rates`,
      );

      return this.cachedRates;
    } catch (error) {
      this.logger.error(
        `Failed to fetch exchange rates: ${error.message}`,
        error.stack,
      );

      if (this.cachedRates.length > 0) {
        this.logger.warn('Using stale cached data due to API error');
        return this.cachedRates;
      }

      throw new Error('Unable to fetch exchange rates and no cache available');
    }
  }

  /**
   * Gets the exchange rate between two currencies
   * @param fromCurrency Source currency code
   * @param toCurrency Target currency code
   * @returns Exchange rate or null if not found
   */
  async getRate(
    fromCurrency: string,
    toCurrency: string,
  ): Promise<number | null> {
    if (fromCurrency === toCurrency) {
      return 1;
    }

    const rates = await this.getExchangeRates();
    const from = fromCurrency === 'GEO' ? 'GEL' : fromCurrency;
    const to = toCurrency === 'GEO' ? 'GEL' : toCurrency;

    const directRate = rates.find(
      (rate) =>
        rate.baseCurrencyCode === from && rate.secondaryCurrencyCode === to,
    );

    if (directRate) {
      return directRate.buyRate;
    }

    const inverseRate = rates.find(
      (rate) =>
        rate.baseCurrencyCode === to && rate.secondaryCurrencyCode === from,
    );

    if (inverseRate && inverseRate.buyRate !== 0) {
      return 1 / inverseRate.buyRate;
    }

    const crossRate = this.findCrossRate(rates, from, to);
    if (crossRate !== null) {
      return crossRate;
    }

    this.logger.warn(
      `No exchange rate found for ${fromCurrency} to ${toCurrency}`,
    );
    return null;
  }

  /**
   * Attempts to find a cross-conversion rate using an intermediate currency
   * @param rates All available rates
   * @param from Source currency
   * @param to Target currency
   * @returns Cross rate or null
   */
  private findCrossRate(
    rates: ExchangeRateDto[],
    from: string,
    to: string,
  ): number | null {
    const intermediates = ['USD', 'GEL', 'EUR'];

    for (const intermediate of intermediates) {
      if (intermediate === from || intermediate === to) continue;

      let fromToIntermediate = rates.find(
        (r) =>
          r.baseCurrencyCode === from && r.secondaryCurrencyCode === intermediate,
      );

      if (!fromToIntermediate) {
        const inverse = rates.find(
          (r) =>
            r.baseCurrencyCode === intermediate &&
            r.secondaryCurrencyCode === from,
        );
        if (inverse && inverse.buyRate !== 0) {
          fromToIntermediate = {
            ...inverse,
            buyRate: 1 / inverse.buyRate,
          };
        }
      }

      let intermediateToTo = rates.find(
        (r) =>
          r.baseCurrencyCode === intermediate && r.secondaryCurrencyCode === to,
      );

      if (!intermediateToTo) {
        const inverse = rates.find(
          (r) =>
            r.baseCurrencyCode === to &&
            r.secondaryCurrencyCode === intermediate,
        );
        if (inverse && inverse.buyRate !== 0) {
          intermediateToTo = {
            ...inverse,
            buyRate: 1 / inverse.buyRate,
          };
        }
      }

      if (fromToIntermediate && intermediateToTo) {
        const crossRate = fromToIntermediate.buyRate * intermediateToTo.buyRate;
        this.logger.debug(
          `Found cross rate ${from} -> ${to} via ${intermediate}: ${crossRate}`,
        );
        return crossRate;
      }
    }

    return null;
  }

  /**
   * Clears the cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.cachedRates = [];
    this.lastFetchTime = 0;
    this.logger.log('Exchange rates cache cleared');
  }

  /**
   * Gets the age of the cache in seconds
   */
  getCacheAge(): number {
    if (this.lastFetchTime === 0) return -1;
    return Math.round((Date.now() - this.lastFetchTime) / 1000);
  }
}
