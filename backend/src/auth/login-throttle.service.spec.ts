import {
  LOGIN_THROTTLE_MAX_FAILURES_GLOBAL,
  LOGIN_THROTTLE_MAX_FAILURES_PER_USERNAME,
  LOGIN_THROTTLE_WINDOW_MS,
  LoginThrottleService,
  TOO_MANY_ATTEMPTS_MESSAGE,
  TooManyRequestsException,
} from './login-throttle.service';

describe('LoginThrottleService', () => {
  let service: LoginThrottleService;

  const fail = (username: string, times: number): void => {
    for (let index = 0; index < times; index += 1) {
      service.recordFailure(username);
    }
  };

  const expectThrottled = (username: string): void => {
    let caught: unknown;

    try {
      service.assertAllowed(username);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(TooManyRequestsException);
    expect((caught as TooManyRequestsException).getStatus()).toBe(429);
    expect((caught as TooManyRequestsException).message).toBe(
      TOO_MANY_ATTEMPTS_MESSAGE,
    );
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-01T12:00:00.000Z'));
    service = new LoginThrottleService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('blocks a username once it reaches 5 failed attempts', () => {
    fail('admin', LOGIN_THROTTLE_MAX_FAILURES_PER_USERNAME - 1);
    expect(() => service.assertAllowed('admin')).not.toThrow();

    service.recordFailure('admin');

    expectThrottled('admin');
  });

  it('keeps the per-username budget isolated between usernames', () => {
    fail('admin', LOGIN_THROTTLE_MAX_FAILURES_PER_USERNAME);

    expectThrottled('admin');
    expect(() => service.assertAllowed('viewer')).not.toThrow();
  });

  it('blocks every username once the global budget is spent', () => {
    for (
      let index = 0;
      index < LOGIN_THROTTLE_MAX_FAILURES_GLOBAL;
      index += 1
    ) {
      service.recordFailure(`attacker-${index}`);
    }

    expectThrottled('attacker-0');
    expectThrottled('never-seen-before');
  });

  it('normalizes usernames with trim and lowercase', () => {
    fail('  Admin ', LOGIN_THROTTLE_MAX_FAILURES_PER_USERNAME);

    expectThrottled('admin');
    expectThrottled('ADMIN');
  });

  it('clears only the given username on reset', () => {
    fail('admin', LOGIN_THROTTLE_MAX_FAILURES_PER_USERNAME);
    fail('viewer', LOGIN_THROTTLE_MAX_FAILURES_PER_USERNAME);

    service.reset('  Admin  ');

    expect(() => service.assertAllowed('admin')).not.toThrow();
    expectThrottled('viewer');
  });

  it('forgets failures older than the 15 minute window', () => {
    fail('admin', LOGIN_THROTTLE_MAX_FAILURES_PER_USERNAME);
    expectThrottled('admin');

    jest.setSystemTime(new Date(Date.now() + LOGIN_THROTTLE_WINDOW_MS + 1));

    expect(() => service.assertAllowed('admin')).not.toThrow();
  });
});
