import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PotsService } from './pots.service';
import { PotsResolver } from './pots.resolver';
import { Pot } from './entities/pot.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Pot])],
  providers: [PotsService, PotsResolver],
  exports: [PotsService],
})
export class PotsModule {}
