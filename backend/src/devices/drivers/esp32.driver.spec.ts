import { BadRequestException } from '@nestjs/common';
import { Esp32Driver } from './esp32.driver';

describe('Esp32Driver', () => {
  let driver: Esp32Driver;

  beforeEach(() => {
    driver = new Esp32Driver();
  });

  it('identifies as the esp32 http driver', () => {
    expect(driver.name).toBe('esp32');
    expect(driver.transport).toBe('http');
  });

  it('supports its declared targets', () => {
    expect(driver.supports('riego')).toBe(true);
    expect(driver.supports('luces')).toBe(true);
    expect(driver.supports('cortina')).toBe(false);
  });

  it.each([
    ['turn_on', 'riego', '/riego/on'],
    ['turn_off', 'riego', '/riego/off'],
    ['turn_on', 'luces', '/luces/on'],
    ['turn_off', 'luces', '/luces/off'],
  ] as const)('resolves %s %s to %s', (action, target, expected) => {
    expect(driver.resolveEndpoint(action, target)).toBe(expected);
  });

  it('fails closed on unknown targets', () => {
    expect(() => driver.resolveEndpoint('turn_on', 'cortina')).toThrow(
      BadRequestException,
    );
  });
});
