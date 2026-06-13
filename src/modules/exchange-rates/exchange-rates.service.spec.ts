import { Test } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { ExchangeRatesService } from './exchange-rates.service';

/**
 * kursi.ge returns entries as { baseCurrencyCode, secondaryCurrencyCode, buyRate }
 * with the convention: 1 secondary = buyRate * base.
 * e.g. { base: 'GEL', secondary: 'USD', buyRate: 2.6552 } => 1 USD = 2.6552 GEL.
 */
const SAMPLE_RATES = [
  {
    baseCurrencyCode: 'GEL',
    secondaryCurrencyCode: 'USD',
    name: 'USD',
    nbgRate: 2.6577,
    diff: 0,
    buyRate: 2.6552,
    sellRate: 2.6622,
    bankRates: {},
  },
  {
    baseCurrencyCode: 'USD',
    secondaryCurrencyCode: 'EUR',
    name: 'EUR',
    nbgRate: 0,
    diff: 0,
    buyRate: 1.154,
    sellRate: 1.163,
    bankRates: {},
  },
];

async function makeService() {
  const httpGet = jest.fn().mockReturnValue(of({ data: SAMPLE_RATES }));
  const moduleRef = await Test.createTestingModule({
    providers: [
      ExchangeRatesService,
      { provide: HttpService, useValue: { get: httpGet } },
    ],
  }).compile();
  return moduleRef.get(ExchangeRatesService);
}

describe('ExchangeRatesService.getRate', () => {
  it('returns 1 for identical currencies', async () => {
    const svc = await makeService();
    expect(await svc.getRate('USD', 'USD')).toBe(1);
  });

  it('converts USD -> GEO as GEL-per-USD (1 USD ≈ 2.66 GEL)', async () => {
    const svc = await makeService();
    const rate = await svc.getRate('USD', 'GEO');
    expect(rate).toBeCloseTo(2.6552, 3);
  });

  it('converts GEO -> USD as the inverse (1 GEL ≈ 0.38 USD)', async () => {
    const svc = await makeService();
    const rate = await svc.getRate('GEO', 'USD');
    expect(rate).toBeCloseTo(1 / 2.6552, 4);
  });

  it('converts using a direct base=from entry as 1/buyRate (USD -> EUR)', async () => {
    const svc = await makeService();
    // entry is base=USD, secondary=EUR, buyRate=1.154 => 1 EUR = 1.154 USD => 1 USD = 1/1.154 EUR
    const rate = await svc.getRate('USD', 'EUR');
    expect(rate).toBeCloseTo(1 / 1.154, 4);
  });
});
