import { JwtModuleOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export const getJwtConfig = (
  configService: ConfigService,
): JwtModuleOptions => ({
  secret: configService.get('JWT_SECRET') || 'your-secret-key-change-this',
  signOptions: {
    expiresIn: configService.get('JWT_EXPIRES_IN') || '7d',
  },
});
