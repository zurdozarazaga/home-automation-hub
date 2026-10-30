import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { BoardSyncService } from './board-sync.service';
import { BoardSyncDto } from './dto/board-sync.dto';
import type { BoardSyncResponse } from './interfaces/board-sync.interface';

@Controller('board')
export class BoardController {
  constructor(private readonly boardSyncService: BoardSyncService) {}

  @Post('sync')
  @Roles('service')
  @HttpCode(HttpStatus.OK)
  async sync(@Body() dto: BoardSyncDto): Promise<BoardSyncResponse> {
    return this.boardSyncService.sync(dto);
  }
}
