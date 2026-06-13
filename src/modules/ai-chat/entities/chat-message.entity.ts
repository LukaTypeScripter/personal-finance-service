import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { ChatRole } from '../enums/chat-role.enum';
import { ChatConversation } from './chat-conversation.entity';

@ObjectType()
@Entity('chat_messages')
@Index(['conversationId', 'createdAt'])
export class ChatMessage {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => ChatRole)
  @Column({ type: 'enum', enum: ChatRole })
  role: ChatRole;

  @Field()
  @Column({ type: 'text' })
  content: string;

  @Field()
  @Column()
  conversationId: string;

  @ManyToOne(() => ChatConversation, (c) => c.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation: ChatConversation;

  @Field()
  @CreateDateColumn()
  createdAt: Date;
}
