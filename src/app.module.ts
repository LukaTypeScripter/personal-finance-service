import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { BudgetsModule } from './modules/budgets/budgets.module';
import { PotsModule } from './modules/pots/pots.module';
import { FinancesModule } from './modules/finances/finances.module';
import { CommonModule } from './common/common.module';
import { getDatabaseConfig } from './config/database.config';
import { getGraphQLConfig } from './config/graphql.config';

@Module({
  imports: [
    // Environment Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database Configuration
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),

    // GraphQL Configuration
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: getGraphQLConfig,
    }),

    // Feature Modules
    CommonModule,
    UsersModule,
    AuthModule,
    TransactionsModule,
    BudgetsModule,
    PotsModule,
    FinancesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
