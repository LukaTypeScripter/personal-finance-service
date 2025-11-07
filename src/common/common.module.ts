import { Global, Module } from '@nestjs/common';
import { CurrencyConverterService } from './services/currency-converter.service';

@Global()
@Module({
  providers: [CurrencyConverterService],
  exports: [CurrencyConverterService],
})
export class CommonModule {}
