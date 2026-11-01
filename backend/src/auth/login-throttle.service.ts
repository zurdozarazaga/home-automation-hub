import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

/** Failed attempts allowed for a single normalized username per window. */
export const LOGIN_THROTTLE_MAX_FAILURES_PER_USERNAME = 5;

/** Failed attempts allowed across all usernames per window. */
export const LOGIN_THROTTLE_MAX_FAILURES_GLOBAL = 20;

/** Sliding window for both budgets. */
export const LOGIN_THROTTLE_WINDOW_MS = 15 * 60 * 1000;

/**
 * Hard cap on tracked usernames. The global budget already stops new
 * entries from being recorded, so this is a second guard against a caller
 * that records failures without calling assertAllowed first.
 */
const MAX_TRACKED_USERNAMES = 1000;

export const TOO_MANY_ATTEMPTS_MESSAGE =
  'Too many login attempts. Try again later.';

/**
 * 429 with a generic body. @nestjs/common ships no 429 exception class, so
 * the throttle owns this one instead of falling back to a bare HttpException
 * at the call site.
 */
export class TooManyRequestsException extends HttpException {
  constructor() {
    super(TOO_MANY_ATTEMPTS_MESSAGE, HttpStatus.TOO_MANY_REQUESTS);
  }
}

/**
 * In-memory login throttle for the single-account login endpoint.
 *
 * Two sliding-window budgets: per normalized username (5) and global (20).
 * State lives in this process only, which is correct for the single-replica
 * deployment; a multi-replica deployment needs a shared store instead.
 *
 * Nothing about the credentials or the attempted username is ever logged.
 */
@Injectable()
export class LoginThrottleService {
  private readonly failuresByUsername = new Map<string, number[]>();
  private globalFailures: number[] = [];

  /**
   * Throws 429 when the attempt would exceed either budget. Called before
   * any credential comparison so a throttled caller learns nothing.
   */
  assertAllowed(username: string): void {
    this.prune(Date.now());

    const usernameFailures =
      this.failuresByUsername.get(this.normalize(username))?.length ?? 0;

    if (
      usernameFailures >= LOGIN_THROTTLE_MAX_FAILURES_PER_USERNAME ||
      this.globalFailures.length >= LOGIN_THROTTLE_MAX_FAILURES_GLOBAL
    ) {
      throw new TooManyRequestsException();
    }
  }

  /** Records one failed attempt for the username and for the global budget. */
  recordFailure(username: string): void {
    const now = Date.now();
    this.prune(now);

    const key = this.normalize(username);
    const failures = this.failuresByUsername.get(key) ?? [];
    failures.push(now);
    this.failuresByUsername.set(key, failures);

    this.globalFailures.push(now);
    this.enforceBound();
  }

  /** Clears the username budget after a successful login. */
  reset(username: string): void {
    this.prune(Date.now());
    this.failuresByUsername.delete(this.normalize(username));
  }

  private normalize(username: string): string {
    return username.trim().toLowerCase();
  }

  /** Drops timestamps that fell out of the window so maps cannot grow stale. */
  private prune(now: number): void {
    const cutoff = now - LOGIN_THROTTLE_WINDOW_MS;

    for (const [key, timestamps] of this.failuresByUsername) {
      const fresh = timestamps.filter((timestamp) => timestamp > cutoff);

      if (fresh.length === 0) {
        this.failuresByUsername.delete(key);
      } else {
        this.failuresByUsername.set(key, fresh);
      }
    }

    this.globalFailures = this.globalFailures.filter(
      (timestamp) => timestamp > cutoff,
    );
  }

  private enforceBound(): void {
    const excess = this.failuresByUsername.size - MAX_TRACKED_USERNAMES;

    if (excess <= 0) {
      return;
    }

    const oldestKeys = Array.from(this.failuresByUsername.keys()).slice(
      0,
      excess,
    );

    for (const key of oldestKeys) {
      this.failuresByUsername.delete(key);
    }
  }
}
