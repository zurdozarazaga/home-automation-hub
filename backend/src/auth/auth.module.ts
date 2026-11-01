import { Logger, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AUTH_TOKEN_TTL } from './auth.constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { LoginThrottleService } from './login-throttle.service';

const MIN_JWT_SECRET_LENGTH = 32;
const MIN_AUTH_PASSWORD_LENGTH = 12;

/**
 * Production-only secret hygiene, evaluated once when the module loads.
 *
 * A missing JWT_SECRET is a hard failure: signing tokens with the test
 * fallback in production would make every token forgeable. Weak values only
 * warn, because crash-looping a running deployment is worse than a warning.
 *
 * Values themselves are never logged.
 */
export function enforceProductionSecrets(): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const logger = new Logger('AuthModule');
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is required in production');
  }

  if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    logger.warn(
      `JWT_SECRET is shorter than ${MIN_JWT_SECRET_LENGTH} characters; use a random secret of at least that length`,
    );
  }

  const authPassword = process.env.AUTH_PASSWORD;

  if (!authPassword) {
    logger.error('AUTH_PASSWORD is not set; login is disabled');
  } else if (authPassword.length < MIN_AUTH_PASSWORD_LENGTH) {
    logger.warn(
      `AUTH_PASSWORD is shorter than ${MIN_AUTH_PASSWORD_LENGTH} characters; use a longer password`,
    );
  }
}

enforceProductionSecrets();

// Production MUST set JWT_SECRET (enforced above). The fallback below exists
// only so unit/e2e tests can run without env wiring; e2e specs mirror the
// same fallback.
const jwtSecret = process.env.JWT_SECRET ?? 'test-secret';

@Module({
  imports: [
    JwtModule.register({
      secret: jwtSecret,
      signOptions: { expiresIn: AUTH_TOKEN_TTL },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LoginThrottleService,
    JwtAuthGuard,
    RolesGuard,
    { provide: APP_GUARD, useExisting: JwtAuthGuard },
    { provide: APP_GUARD, useExisting: RolesGuard },
  ],
  exports: [JwtModule, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
