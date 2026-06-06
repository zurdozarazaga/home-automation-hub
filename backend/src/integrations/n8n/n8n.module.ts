import { Module } from '@nestjs/common';
import { ActionsModule } from '../../actions/actions.module';
import { N8nController } from './n8n.controller';
import { N8nService } from './n8n.service';

@Module({
  imports: [ActionsModule],
  controllers: [N8nController],
  providers: [N8nService],
})
export class N8nModule {}
