import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { ObjectType, Field, ID, Float } from '@nestjs/graphql';
import { User } from '../../users/entities/user.entity';
import { Currency } from '../../../common/enums/currency.enum';

@ObjectType()
@Entity('budgets')
@Unique(['userId', 'category'])
export class Budget {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column()
  category: string;

  @Field(() => Float)
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  maximum: number;

  @Field()
  @Column({
    type: 'enum',
    enum: Currency,
    default: Currency.USD,
  })
  currency: Currency;

  @Field()
  @Column()
  theme: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.budgets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
