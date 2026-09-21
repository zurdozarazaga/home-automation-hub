export interface LoginResponse {
  accessToken: string;
  /** Token lifetime in seconds (OAuth-style), mirrors the signed JWT exp. */
  expiresIn: number;
}
