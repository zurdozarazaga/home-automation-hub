import { Module } from '@nestjs/common';
import { ActionsModule } from '../actions/actions.module';
import { DevicesModule } from '../devices/devices.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { BoardController } from './board.controller';
import { BoardSweepService } from './board-sweep.service';
import { BoardSyncService } from './board-sync.service';
import { DeviceCommandsModule } from './device-commands.module';

/**
 * Push link (DEVICE_LINK_MODE=push): the board reaches POST /board/sync
 * with its state and acks, and receives pending commands in the response.
 * The hub can live outside the board's LAN (e.g. a VPS).
 */
@Module({
  imports: [
    DevicesModule,
    TelemetryModule,
    ActionsModule,
    DeviceCommandsModule,
  ],
  controllers: [BoardController],
  providers: [BoardSyncService, BoardSweepService],
})
export class BoardModule {}
