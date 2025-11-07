import { Injectable } from '@nestjs/common';
import { Currency } from '../enums/currency.enum';

@Injectable()
export class CurrencyConverterService {
  // Exchange rates (hardcoded as per requirements)
  private readonly rates = {
    USD_TO_GEO: 2.7, // 1 USD = 2.7 GEO
    GEO_TO_USD: 0.37, // 1 GEO = 0.37 USD
  };

  /**
   * Convert amount from one currency to another
   * @param amount - The amount to convert
   * @param fromCurrency - Source currency
   * @param toCurrency - Target currency
   * @returns Converted amount
   */
  convertCurrency(
    amount: number,
    fromCurrency: Currency,
    toCurrency: Currency,
  ): number {
    if (fromCurrency === toCurrency) {
      return amount;
    }

    if (fromCurrency === Currency.USD && toCurrency === Currency.GEO) {
      return amount * this.rates.USD_TO_GEO;
    } else if (fromCurrency === Currency.GEO && toCurrency === Currency.USD) {
      return amount * this.rates.GEO_TO_USD;
    }

    // Return original amount if conversion not supported
    return amount;
  }

  /**
   * Get exchange rate between two currencies
   * @param fromCurrency - Source currency
   * @param toCurrency - Target currency
   * @returns Exchange rate
   */
  getExchangeRate(fromCurrency: Currency, toCurrency: Currency): number {
    if (fromCurrency === toCurrency) {
      return 1;
    }

    if (fromCurrency === Currency.USD && toCurrency === Currency.GEO) {
      return this.rates.USD_TO_GEO;
    } else if (fromCurrency === Currency.GEO && toCurrency === Currency.USD) {
      return this.rates.GEO_TO_USD;
    }

    return 1;
  }
}
