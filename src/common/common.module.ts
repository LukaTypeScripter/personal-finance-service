import { Global, Module } from '@nestjs/common';
import { CurrencyConverterService } from './services/currency-converter.service';
import { ExchangeRatesModule } from '../modules/exchange-rates/exchange-rates.module';

@Global()
@Module({
  imports: [ExchangeRatesModule],
  providers: [CurrencyConverterService],
  exports: [CurrencyConverterService],
})
export class CommonModule {}
