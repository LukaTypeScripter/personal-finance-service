import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../modules/users/entities/user.entity';
import { Currency } from '../common/enums/currency.enum';
import { Transaction } from '../modules/transactions/entities/transaction.entity';
import { Budget } from '../modules/budgets/entities/budget.entity';
import { Pot } from '../modules/pots/entities/pot.entity';

// Transaction templates for generating realistic data
const transactionTemplates = {
  income: [
    { name: 'Monthly Salary', category: 'Salary', minAmount: 3000, maxAmount: 8000, recurring: true },
    { name: 'Freelance Project', category: 'Freelance', minAmount: 500, maxAmount: 2500, recurring: false },
    { name: 'Consulting Fee', category: 'Freelance', minAmount: 800, maxAmount: 3000, recurring: false },
    { name: 'Investment Return', category: 'Investment', minAmount: 100, maxAmount: 1000, recurring: false },
    { name: 'Dividend Payment', category: 'Investment', minAmount: 50, maxAmount: 500, recurring: false },
    { name: 'Bonus', category: 'Salary', minAmount: 500, maxAmount: 3000, recurring: false },
    { name: 'Side Hustle', category: 'Freelance', minAmount: 200, maxAmount: 1000, recurring: false },
  ],
  expenses: [
    { name: 'Rent Payment', category: 'Housing', minAmount: 800, maxAmount: 2000, recurring: true, avatar: '🏠' },
    { name: 'Mortgage', category: 'Housing', minAmount: 1200, maxAmount: 2500, recurring: true, avatar: '🏡' },
    { name: 'Grocery Store', category: 'Food', minAmount: 50, maxAmount: 200, recurring: false, avatar: '🛒' },
    { name: 'Restaurant Dinner', category: 'Food', minAmount: 30, maxAmount: 150, recurring: false, avatar: '🍽️' },
    { name: 'Coffee Shop', category: 'Food', minAmount: 5, maxAmount: 25, recurring: false, avatar: '☕' },
    { name: 'Fast Food', category: 'Food', minAmount: 8, maxAmount: 30, recurring: false, avatar: '🍔' },
    { name: 'Electric Bill', category: 'Utilities', minAmount: 60, maxAmount: 150, recurring: true, avatar: '⚡' },
    { name: 'Water Bill', category: 'Utilities', minAmount: 30, maxAmount: 80, recurring: true, avatar: '💧' },
    { name: 'Internet Bill', category: 'Utilities', minAmount: 40, maxAmount: 100, recurring: true, avatar: '🌐' },
    { name: 'Phone Bill', category: 'Utilities', minAmount: 30, maxAmount: 80, recurring: true, avatar: '📱' },
    { name: 'Gas Station', category: 'Transportation', minAmount: 40, maxAmount: 100, recurring: false, avatar: '⛽' },
    { name: 'Uber Ride', category: 'Transportation', minAmount: 10, maxAmount: 50, recurring: false, avatar: '🚗' },
    { name: 'Public Transit', category: 'Transportation', minAmount: 5, maxAmount: 20, recurring: false, avatar: '🚇' },
    { name: 'Car Payment', category: 'Transportation', minAmount: 200, maxAmount: 600, recurring: true, avatar: '🚙' },
    { name: 'Netflix Subscription', category: 'Entertainment', minAmount: 10, maxAmount: 20, recurring: true, avatar: '📺' },
    { name: 'Spotify Premium', category: 'Entertainment', minAmount: 10, maxAmount: 20, recurring: true, avatar: '🎵' },
    { name: 'Movie Tickets', category: 'Entertainment', minAmount: 15, maxAmount: 50, recurring: false, avatar: '🎬' },
    { name: 'Concert Tickets', category: 'Entertainment', minAmount: 50, maxAmount: 200, recurring: false, avatar: '🎤' },
    { name: 'Gym Membership', category: 'Health', minAmount: 30, maxAmount: 100, recurring: true, avatar: '💪' },
    { name: 'Doctor Visit', category: 'Health', minAmount: 50, maxAmount: 300, recurring: false, avatar: '👨‍⚕️' },
    { name: 'Pharmacy', category: 'Health', minAmount: 15, maxAmount: 80, recurring: false, avatar: '💊' },
    { name: 'Dental Checkup', category: 'Health', minAmount: 80, maxAmount: 250, recurring: false, avatar: '🦷' },
    { name: 'Online Shopping', category: 'Shopping', minAmount: 30, maxAmount: 300, recurring: false, avatar: '🛍️' },
    { name: 'Clothing Store', category: 'Shopping', minAmount: 40, maxAmount: 250, recurring: false, avatar: '👔' },
    { name: 'Electronics Store', category: 'Shopping', minAmount: 50, maxAmount: 500, recurring: false, avatar: '📱' },
    { name: 'Home Goods', category: 'Shopping', minAmount: 25, maxAmount: 200, recurring: false, avatar: '🏠' },
    { name: 'Insurance Premium', category: 'Insurance', minAmount: 100, maxAmount: 400, recurring: true, avatar: '🛡️' },
    { name: 'Pet Supplies', category: 'Pets', minAmount: 20, maxAmount: 100, recurring: false, avatar: '🐕' },
    { name: 'Books', category: 'Education', minAmount: 15, maxAmount: 60, recurring: false, avatar: '📚' },
    { name: 'Online Course', category: 'Education', minAmount: 50, maxAmount: 300, recurring: false, avatar: '🎓' },
  ],
};

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomFloat(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function getRandomDate(startDate: Date, endDate: Date): Date {
  const start = startDate.getTime();
  const end = endDate.getTime();
  const randomTime = start + Math.random() * (end - start);
  return new Date(randomTime);
}

function generateTransactions(userId: string, currency: Currency, count: number = 150) {
  const transactions: any[] = [];
  const today = new Date();
  const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 6, 1);

  // Generate income transactions (about 20% of total)
  const incomeCount = Math.floor(count * 0.2);
  for (let i = 0; i < incomeCount; i++) {
    const template = transactionTemplates.income[getRandomInt(0, transactionTemplates.income.length - 1)];
    const amount = getRandomFloat(template.minAmount, template.maxAmount);
    const date = getRandomDate(sixMonthsAgo, today);

    transactions.push({
      userId,
      name: template.name,
      category: template.category,
      amount: currency === Currency.GEO ? amount * 2.7 : amount, // Adjust for GEO currency
      date,
      currency,
      recurring: template.recurring,
    });
  }

  // Generate expense transactions (remaining 80%)
  const expenseCount = count - incomeCount;
  for (let i = 0; i < expenseCount; i++) {
    const template = transactionTemplates.expenses[getRandomInt(0, transactionTemplates.expenses.length - 1)];
    const amount = getRandomFloat(template.minAmount, template.maxAmount);
    const date = getRandomDate(sixMonthsAgo, today);

    transactions.push({
      userId,
      name: template.name,
      category: template.category,
      amount: -(currency === Currency.GEO ? amount * 2.7 : amount), // Negative for expenses
      date,
      currency,
      recurring: template.recurring,
      avatar: template.avatar,
    });
  }

  // Sort by date
  transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

  return transactions;
}

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'Croco2021@',
    database: process.env.DB_DATABASE || 'personal-finance',
    entities: [User, Transaction, Budget, Pot],
    synchronize: true,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');

    // Clear existing data
    await dataSource.query('TRUNCATE TABLE transactions, budgets, pots, users CASCADE');
    console.log('🧹 Cleared existing data');

    const userRepository = dataSource.getRepository(User);
    const transactionRepository = dataSource.getRepository(Transaction);
    const budgetRepository = dataSource.getRepository(Budget);
    const potRepository = dataSource.getRepository(Pot);

    // Create Users
    const hashedPassword = await bcrypt.hash('password123', 10);

    const user1 = await userRepository.save({
      name: 'John Doe',
      email: 'john@example.com',
      password: hashedPassword,
      currency: Currency.USD,
    });

    const user2 = await userRepository.save({
      name: 'Jane Smith',
      email: 'jane@example.com',
      password: hashedPassword,
      currency: Currency.GEO,
    });

    const user3 = await userRepository.save({
      name: 'Bob Wilson',
      email: 'bob@example.com',
      password: hashedPassword,
      currency: Currency.USD,
    });

    console.log('✅ Created 3 users');

    // Generate 150 transactions for each user
    console.log('📝 Generating transactions...');

    const user1Transactions = generateTransactions(user1.id, Currency.USD, 150);
    const user2Transactions = generateTransactions(user2.id, Currency.GEO, 150);
    const user3Transactions = generateTransactions(user3.id, Currency.USD, 150);

    // Batch insert for better performance
    console.log('💾 Saving transactions to database...');
    await transactionRepository.save(user1Transactions);
    console.log(`   ✓ User 1 (John): ${user1Transactions.length} transactions`);

    await transactionRepository.save(user2Transactions);
    console.log(`   ✓ User 2 (Jane): ${user2Transactions.length} transactions`);

    await transactionRepository.save(user3Transactions);
    console.log(`   ✓ User 3 (Bob): ${user3Transactions.length} transactions`);

    console.log('✅ Created transactions for all users');

    // Create Budgets for User 1
    const user1Budgets = [
      { category: 'Food', maximum: 500, theme: '#22C55E' },
      { category: 'Housing', maximum: 1500, theme: '#3B82F6' },
      { category: 'Transportation', maximum: 300, theme: '#F59E0B' },
      { category: 'Entertainment', maximum: 200, theme: '#EF4444' },
      { category: 'Utilities', maximum: 200, theme: '#8B5CF6' },
      { category: 'Health', maximum: 150, theme: '#EC4899' },
      { category: 'Shopping', maximum: 300, theme: '#14B8A6' },
    ];

    for (const budget of user1Budgets) {
      await budgetRepository.save({
        ...budget,
        userId: user1.id,
        currency: Currency.USD,
      });
    }

    // Create Budgets for User 2
    const user2Budgets = [
      { category: 'Food', maximum: 1350, theme: '#22C55E' },
      { category: 'Housing', maximum: 4050, theme: '#3B82F6' },
      { category: 'Transportation', maximum: 810, theme: '#F59E0B' },
      { category: 'Entertainment', maximum: 540, theme: '#EF4444' },
      { category: 'Utilities', maximum: 540, theme: '#8B5CF6' },
      { category: 'Health', maximum: 405, theme: '#EC4899' },
      { category: 'Shopping', maximum: 810, theme: '#14B8A6' },
    ];

    for (const budget of user2Budgets) {
      await budgetRepository.save({
        ...budget,
        userId: user2.id,
        currency: Currency.GEO,
      });
    }

    // Create Budgets for User 3
    const user3Budgets = [
      { category: 'Food', maximum: 600, theme: '#22C55E' },
      { category: 'Housing', maximum: 2000, theme: '#3B82F6' },
      { category: 'Transportation', maximum: 500, theme: '#F59E0B' },
      { category: 'Insurance', maximum: 250, theme: '#8B5CF6' },
      { category: 'Utilities', maximum: 150, theme: '#EC4899' },
    ];

    for (const budget of user3Budgets) {
      await budgetRepository.save({
        ...budget,
        userId: user3.id,
        currency: Currency.USD,
      });
    }

    console.log('✅ Created budgets for all users');

    // Create Pots (Savings Goals) for User 1
    const user1Pots = [
      { name: 'Emergency Fund', target: 10000, total: 3500, theme: '#EF4444' },
      { name: 'Vacation to Europe', target: 5000, total: 1200, theme: '#3B82F6' },
      { name: 'New Laptop', target: 2000, total: 800, theme: '#8B5CF6' },
      { name: 'Car Down Payment', target: 15000, total: 5000, theme: '#F59E0B' },
    ];

    for (const pot of user1Pots) {
      await potRepository.save({
        ...pot,
        userId: user1.id,
        currency: Currency.USD,
      });
    }

    // Create Pots for User 2
    const user2Pots = [
      { name: 'Emergency Fund', target: 27000, total: 9450, theme: '#EF4444' },
      { name: 'Wedding', target: 13500, total: 5400, theme: '#EC4899' },
      { name: 'New Phone', target: 2700, total: 1350, theme: '#8B5CF6' },
    ];

    for (const pot of user2Pots) {
      await potRepository.save({
        ...pot,
        userId: user2.id,
        currency: Currency.GEO,
      });
    }

    // Create Pots for User 3
    const user3Pots = [
      { name: 'Emergency Fund', target: 12000, total: 4500, theme: '#EF4444' },
      { name: 'Home Renovation', target: 20000, total: 8000, theme: '#3B82F6' },
      { name: 'Retirement', target: 100000, total: 25000, theme: '#22C55E' },
    ];

    for (const pot of user3Pots) {
      await potRepository.save({
        ...pot,
        userId: user3.id,
        currency: Currency.USD,
      });
    }

    console.log('✅ Created pots for all users');

    console.log('\n🎉 Seed completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Users: 3`);
    console.log(`   - Transactions: 450 (150 per user)`);
    console.log(`   - Budgets: ${user1Budgets.length + user2Budgets.length + user3Budgets.length}`);
    console.log(`   - Pots: ${user1Pots.length + user2Pots.length + user3Pots.length}`);
    console.log('\n👥 Test Users:');
    console.log(`   - john@example.com (USD) - password: password123 - 150 transactions`);
    console.log(`   - jane@example.com (GEO) - password: password123 - 150 transactions`);
    console.log(`   - bob@example.com (USD) - password: password123 - 150 transactions`);

    await dataSource.destroy();
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seed();
