import { parseRegisterDeviceArgs } from './register-device';

describe('parseRegisterDeviceArgs', () => {
  it('parses required flags and the optional description', () => {
    expect(
      parseRegisterDeviceArgs([
        '--name',
        'riego-patio',
        '--ip',
        '192.168.1.50',
        '--port',
        '80',
      ]),
    ).toEqual({
      name: 'riego-patio',
      ip: '192.168.1.50',
      port: 80,
      description: undefined,
    });

    expect(
      parseRegisterDeviceArgs([
        '--name',
        'riego-patio',
        '--ip',
        '192.168.1.50',
        '--port',
        '80',
        '--description',
        'DHT22 node',
      ]),
    ).toEqual({
      name: 'riego-patio',
      ip: '192.168.1.50',
      port: 80,
      description: 'DHT22 node',
    });
  });

  it('trims whitespace around values', () => {
    expect(
      parseRegisterDeviceArgs([
        '--name',
        ' riego ',
        '--ip',
        ' 192.168.1.50 ',
        '--port',
        ' 80 ',
      ]),
    ).toEqual({
      name: 'riego',
      ip: '192.168.1.50',
      port: 80,
      description: undefined,
    });
  });

  it('rejects missing required flags', () => {
    expect(() => parseRegisterDeviceArgs([])).toThrow(/--name is required/);
    expect(() => parseRegisterDeviceArgs(['--name', 'x'])).toThrow(
      /--ip is required/,
    );
    expect(() =>
      parseRegisterDeviceArgs(['--name', 'x', '--ip', '192.168.1.50']),
    ).toThrow(/--port is required/);
  });

  it('rejects invalid ip and port values', () => {
    expect(() =>
      parseRegisterDeviceArgs([
        '--name',
        'x',
        '--ip',
        'not-an-ip',
        '--port',
        '80',
      ]),
    ).toThrow(/--ip must be a valid IPv4 address/);

    expect(() =>
      parseRegisterDeviceArgs([
        '--name',
        'x',
        '--ip',
        '192.168.1.50',
        '--port',
        '0',
      ]),
    ).toThrow(/--port must be an integer/);

    expect(() =>
      parseRegisterDeviceArgs([
        '--name',
        'x',
        '--ip',
        '192.168.1.50',
        '--port',
        '70000',
      ]),
    ).toThrow(/--port must be an integer/);

    expect(() =>
      parseRegisterDeviceArgs([
        '--name',
        'x',
        '--ip',
        '192.168.1.50',
        '--port',
        'eighty',
      ]),
    ).toThrow(/--port must be an integer/);
  });

  it('rejects unknown flags, duplicates, missing values and positionals', () => {
    expect(() =>
      parseRegisterDeviceArgs([
        '--name',
        'x',
        '--ip',
        '192.168.1.50',
        '--port',
        '80',
        '--wat',
        '1',
      ]),
    ).toThrow(/Unknown option/);

    expect(() =>
      parseRegisterDeviceArgs([
        '--name',
        'x',
        '--name',
        'y',
        '--ip',
        '192.168.1.50',
        '--port',
        '80',
      ]),
    ).toThrow(/Duplicated option/);

    expect(() =>
      parseRegisterDeviceArgs([
        '--name',
        'x',
        '--ip',
        '192.168.1.50',
        '--port',
      ]),
    ).toThrow(/Missing value/);

    expect(() => parseRegisterDeviceArgs(['positional'])).toThrow(
      /Unexpected argument/,
    );
  });
});
