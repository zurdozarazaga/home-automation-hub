import { PrismaClient } from '@prisma/client';
import { isIP } from 'net';

export interface RegisterDeviceOptions {
  name: string;
  ip: string;
  port: number;
  description?: string;
}

const SUPPORTED_FLAGS = new Set(['--name', '--ip', '--port', '--description']);

const USAGE =
  'Usage: npm run devices:register -- --name <name> --ip <ipv4> --port <port> [--description <text>]';

export function parseRegisterDeviceArgs(argv: string[]): RegisterDeviceOptions {
  const values = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];

    if (!flag?.startsWith('--')) {
      throw new Error(`Unexpected argument: ${flag ?? ''}\n${USAGE}`);
    }

    if (!SUPPORTED_FLAGS.has(flag)) {
      throw new Error(`Unknown option: ${flag}\n${USAGE}`);
    }

    const value = argv[index + 1];

    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Missing value for ${flag}\n${USAGE}`);
    }

    if (values.has(flag)) {
      throw new Error(`Duplicated option: ${flag}\n${USAGE}`);
    }

    values.set(flag, value.trim());
    index += 1;
  }

  const name = values.get('--name');
  const ip = values.get('--ip');
  const portRaw = values.get('--port');
  const description = values.get('--description');

  if (!name) {
    throw new Error(`--name is required\n${USAGE}`);
  }

  if (!ip) {
    throw new Error(`--ip is required\n${USAGE}`);
  }

  if (isIP(ip) !== 4) {
    throw new Error(`--ip must be a valid IPv4 address\n${USAGE}`);
  }

  if (portRaw === undefined || portRaw === '') {
    throw new Error(`--port is required\n${USAGE}`);
  }

  const port = Number(portRaw);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`--port must be an integer between 1 and 65535\n${USAGE}`);
  }

  return { name, ip, port, description: description || undefined };
}

/**
 * Upserts the physical board in Postgres by name so it can be registered
 * when it arrives (and re-run safely after an IP change). Always esp32.
 */
export async function registerDevice(
  options: RegisterDeviceOptions,
): Promise<string> {
  const prisma = new PrismaClient();

  try {
    const device = await prisma.device.upsert({
      where: { name: options.name },
      update: {
        ipAddress: options.ip,
        port: options.port,
        driver: 'esp32',
        ...(options.description !== undefined
          ? { description: options.description }
          : {}),
      },
      create: {
        name: options.name,
        description: options.description ?? '',
        driver: 'esp32',
        capabilities: ['riego', 'luces'],
        ipAddress: options.ip,
        port: options.port,
        status: 'offline',
      },
    });

    return device.id;
  } catch (error) {
    // CLI context: never leak raw Prisma errors, exit non-zero instead.
    throw new Error(
      `Failed to register device '${options.name}': ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  const options = parseRegisterDeviceArgs(process.argv.slice(2));

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set; refusing to touch the database.');
  }

  const id = await registerDevice(options);
  console.log(
    `Device "${options.name}" registered with id ${id} at ${options.ip}:${options.port}`,
  );
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
