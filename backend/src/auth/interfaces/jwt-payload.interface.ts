import type { Role } from './role.interface';

export interface JwtPayload {
  sub: string;
  role: Role;
  iat?: number;
  exp?: number;
}
