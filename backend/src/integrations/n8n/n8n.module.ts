import { Module } from '@nestjs/common';
import { ActionsModule } from '../../actions/actions.module';
import { N8nController } from './n8n.controller';

@Module({
  imports: [ActionsModule],
  controllers: [N8nController],
})
export class N8nModule {}
