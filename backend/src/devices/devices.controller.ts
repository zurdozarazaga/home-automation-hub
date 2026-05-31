import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { DevicesService } from './devices.service';
import { Device } from './interfaces/device.interface';

@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  async findAll(): Promise<Device[]> {
    return this.devicesService.findAll();
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string): Promise<Device> {
    return this.devicesService.findById(id);
  }

  @Post()
  async create(@Body() createDeviceDto: CreateDeviceDto): Promise<Device> {
    return this.devicesService.create(createDeviceDto);
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDeviceDto: UpdateDeviceDto,
  ): Promise<Device> {
    return this.devicesService.update(id, updateDeviceDto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.devicesService.remove(id);
  }
}
