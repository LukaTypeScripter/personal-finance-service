import { ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';

export const getGraphQLConfig = (
  configService: ConfigService,
): ApolloDriverConfig => ({
  autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
  sortSchema: true,
  playground: configService.get('GRAPHQL_PLAYGROUND') === 'true',
  debug: configService.get('NODE_ENV') === 'development',
  csrfPrevention: false, // Disable CSRF protection for development
  context: ({ req, res }) => ({ req, res }),
});
