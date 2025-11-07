export class BankRateDto {
  buyRate: number;
  sellRate: number;
}

export class BankRatesDto {
  TBC?: BankRateDto;
  BOG?: BankRateDto;
  [key: string]: BankRateDto | undefined;
}

export class ExchangeRateDto {
  baseCurrencyCode: string;
  secondaryCurrencyCode: string;
  name: string;
  nbgRate: number;
  diff: number;
  buyRate: number;
  sellRate: number;
  bankRates: BankRatesDto;
}
