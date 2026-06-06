import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    if (!this.isEnabled()) {
      this.logger.log('Prisma datasource disabled (DATA_SOURCE != prisma).');
      return;
    }

    await this.$connect();
    this.logger.log('Prisma client connected.');
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    await this.$disconnect();
    this.logger.log('Prisma client disconnected.');
  }

  isEnabled(): boolean {
    return process.env.DATA_SOURCE === 'prisma';
  }
}
