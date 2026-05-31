import { Injectable } from '@nestjs/common';

@Injectable()
export class PrismaService {
  isEnabled(): boolean {
    return process.env.DATA_SOURCE === 'prisma';
  }

  // TODO(prisma): Replace this placeholder service with PrismaClient lifecycle hooks.
  // TODO(prisma): Implement onModuleInit / onModuleDestroy and expose typed prisma client.
}
