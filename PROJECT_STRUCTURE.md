# Personal Finance Service - Project Structure

## Overview
This is a NestJS-based personal finance service with PostgreSQL database and GraphQL API. The project follows enterprise-grade architectural patterns for scalability and maintainability.

## Tech Stack
- **Framework**: NestJS 11
- **Database**: PostgreSQL with TypeORM
- **API**: GraphQL with Apollo Server
- **Authentication**: JWT with Passport
- **Validation**: class-validator & class-transformer
- **Language**: TypeScript

## Project Structure

```
src/
├── common/                      # Shared utilities and resources
│   ├── decorators/             # Custom decorators
│   │   └── current-user.decorator.ts
│   ├── guards/                 # Auth guards
│   │   └── gql-auth.guard.ts
│   ├── interfaces/             # Shared TypeScript interfaces
│   │   └── jwt-payload.interface.ts
│   └── filters/                # Exception filters (future)
│
├── config/                      # Configuration files
│   ├── database.config.ts      # Database configuration
│   ├── graphql.config.ts       # GraphQL configuration
│   └── jwt.config.ts           # JWT configuration
│
├── modules/                     # Feature modules
│   ├── auth/                   # Authentication module
│   │   ├── dto/
│   │   │   ├── auth.input.ts   # GraphQL input types
│   │   │   └── auth.response.ts # GraphQL response types
│   │   ├── strategies/
│   │   │   └── jwt.strategy.ts # JWT passport strategy
│   │   ├── auth.module.ts
│   │   ├── auth.service.ts     # Auth business logic
│   │   └── auth.resolver.ts    # GraphQL resolvers
│   │
│   └── users/                  # Users module
│       ├── dto/                # Data transfer objects
│       ├── entities/
│       │   └── user.entity.ts  # User database entity
│       ├── users.module.ts
│       ├── users.service.ts    # Users business logic
│       └── users.resolver.ts   # GraphQL resolvers
│
├── app.module.ts               # Root application module
└── main.ts                     # Application entry point
```

## Architecture Principles

### 1. **Separation of Concerns**
- Each module handles a specific domain (auth, users, etc.)
- Common utilities are shared across modules
- Configuration is centralized in `config/`

### 2. **Module Structure**
Each feature module follows this pattern:
```
module-name/
├── dto/            # Data transfer objects
├── entities/       # Database entities
├── module.ts       # Module definition
├── service.ts      # Business logic
└── resolver.ts     # GraphQL API layer
```

### 3. **Layered Architecture**
1. **Resolver Layer** (`*.resolver.ts`): Handles GraphQL requests, validation, guards
2. **Service Layer** (`*.service.ts`): Contains business logic
3. **Entity Layer** (`entities/*.entity.ts`): Database models with TypeORM

### 4. **Configuration Management**
- All config logic extracted to `config/` directory
- Uses factory functions with ConfigService
- Environment-based configuration via `.env`

## Key Features

### Authentication
- JWT-based authentication
- Password hashing with bcrypt
- GraphQL guards for protected routes
- Register, login, and "me" queries

### Database
- PostgreSQL with TypeORM
- Auto-synchronization in development
- UUID primary keys
- Automatic timestamps (createdAt, updatedAt)

### GraphQL
- Code-first approach with auto-generated schema
- Input validation with class-validator
- Context-based authentication
- Playground available in development

## Environment Variables

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=personal-finance

# Application
PORT=3000
NODE_ENV=development

# GraphQL
GRAPHQL_PLAYGROUND=true

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
```

## Common Patterns

### Creating a New Module

1. Create module directory under `src/modules/`
2. Create subfolders: `dto/`, `entities/`
3. Create: `module.ts`, `service.ts`, `resolver.ts`
4. Register in `app.module.ts`

### Adding a New Entity

```typescript
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
@Entity('table_name')
export class EntityName {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column()
  property: string;
}
```

### Protected GraphQL Resolver

```typescript
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Query(() => ReturnType)
@UseGuards(GqlAuthGuard)
async protectedQuery(@CurrentUser() user: User) {
  // Your logic here
}
```

## Scripts

```bash
# Development
npm run start:dev

# Production build
npm run build
npm run start:prod

# Testing
npm run test
npm run test:e2e
npm run test:cov

# Linting
npm run lint
```

## Best Practices

1. **Always use DTOs** for input/output validation
2. **Keep business logic in services**, not resolvers
3. **Use guards** for authentication/authorization
4. **Extract configuration** to config files
5. **Follow naming conventions**: `*.module.ts`, `*.service.ts`, `*.resolver.ts`
6. **Write tests** for services and resolvers
7. **Use TypeScript strict mode** for type safety
8. **Document complex logic** with comments

## Future Enhancements

- [ ] Exception filters
- [ ] Logging interceptor
- [ ] Database migrations
- [ ] Unit and integration tests
- [ ] API documentation
- [ ] Rate limiting
- [ ] Refresh tokens
- [ ] Email verification
- [ ] Role-based access control (RBAC)

## Development Workflow

1. Create feature branch
2. Implement feature following structure above
3. Write tests
4. Create pull request
5. Code review
6. Merge to main

## Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeORM Documentation](https://typeorm.io/)
- [GraphQL Documentation](https://graphql.org/)
- [Apollo Server](https://www.apollographql.com/docs/apollo-server/)
