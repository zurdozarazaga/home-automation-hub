import { validate } from 'class-validator';
import { CreateDeviceDto } from './create-device.dto';
import { UpdateDeviceDto } from './update-device.dto';

function createDto(overrides: Partial<CreateDeviceDto>): CreateDeviceDto {
  const dto = new CreateDeviceDto();
  Object.assign(
    dto,
    {
      name: 'Riego Patio',
      description: 'Controla riego del patio',
      ipAddress: '192.168.1.10',
      port: 80,
    } satisfies Partial<CreateDeviceDto>,
    overrides,
  );
  return dto;
}

describe('CreateDeviceDto conditional network validation', () => {
  it('accepts a full ESP32 device', async () => {
    await expect(validate(createDto({}))).resolves.toHaveLength(0);
  });

  it('rejects ESP32 devices without network address', async () => {
    const dto = createDto({ ipAddress: undefined, port: undefined });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property).sort()).toEqual([
      'ipAddress',
      'port',
    ]);
  });

  it('accepts topic-addressed drivers without network address', async () => {
    const dto = createDto({
      driver: 'mqtt-generic',
      mqttTopic: 'riego/zona-1',
      ipAddress: undefined,
      port: undefined,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('accepts driver metadata alongside the network address', async () => {
    const dto = createDto({
      driver: 'esp32',
      capabilities: ['riego'],
      mqttTopic: undefined,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});

describe('UpdateDeviceDto conditional network validation', () => {
  it('accepts partial updates without network fields', async () => {
    const dto = new UpdateDeviceDto();
    Object.assign(dto, { name: 'Nuevo nombre' });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects invalid network fields when provided', async () => {
    const dto = new UpdateDeviceDto();
    Object.assign(dto, { ipAddress: 'no-es-ip', port: 99999 });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property).sort()).toEqual([
      'ipAddress',
      'port',
    ]);
  });
});
