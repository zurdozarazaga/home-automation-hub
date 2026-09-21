import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, timingSafeEqual } from 'crypto';
import {
  AUTH_TOKEN_TTL_SECONDS,
  DEFAULT_AUTH_USERNAME,
} from './auth.constants';
import { LoginDto } from './dto/login.dto';
import type { JwtPayload } from './interfaces/jwt-payload.interface';
import type { LoginResponse } from './interfaces/login.interface';

/**
 * Credential login for the single frontend/admin account.
 *
 * Credentials come from the environment (AUTH_USERNAME / AUTH_PASSWORD):
 * there is intentionally no user store. With one account there is nothing
 * to enumerate, and the endpoint is expected to sit on a trusted network /
 * behind a reverse proxy.
 *
 * TODO(auth): add rate limiting (per-IP lockout is the minimum) and a real
 * user store before exposing login to untrusted networks.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly jwtService: JwtService) {}

  async login(loginDto: LoginDto): Promise<LoginResponse> {
    const expectedPassword = process.env.AUTH_PASSWORD;

    if (!expectedPassword) {
      this.logger.error(
        'login disabled: AUTH_PASSWORD not set; refusing to authenticate',
      );
      throw new ServiceUnavailableException('Login is disabled');
    }

    const expectedUsername = process.env.AUTH_USERNAME ?? DEFAULT_AUTH_USERNAME;

    // Hash both sides before comparing so timingSafeEqual always receives
    // equal-length buffers: comparison time cannot leak credential length.
    const usernameMatches = this.safeCompare(
      loginDto.username,
      expectedUsername,
    );
    const passwordMatches = this.safeCompare(
      loginDto.password,
      expectedPassword,
    );

    if (!usernameMatches || !passwordMatches) {
      // Generic response and no logging: never reveal which part failed and
      // never write credentials to logs.
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = { sub: expectedUsername, role: 'admin' };
    const accessToken = await this.jwtService.signAsync(payload);

    return { accessToken, expiresIn: AUTH_TOKEN_TTL_SECONDS };
  }

  private safeCompare(provided: string, expected: string): boolean {
    const providedDigest = createHash('sha256').update(provided).digest();
    const expectedDigest = createHash('sha256').update(expected).digest();

    return timingSafeEqual(providedDigest, expectedDigest);
  }
}
