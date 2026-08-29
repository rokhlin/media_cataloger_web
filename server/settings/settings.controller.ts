import { Controller, Get, Post, Body, Query, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SettingsService } from './settings.service.js';
import { SettingsUpdateRequestDto } from './dto/settings.dto.js';

@ApiTags('settings')
@Controller('api')
export class SettingsController {
  constructor(@Inject(SettingsService) private readonly settingsService: SettingsService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Get current path configurations and defaults' })
  @ApiResponse({ status: 200, description: 'Current configuration' })
  getSettings() {
    return this.settingsService.getSettings();
  }

  @Post('settings')
  @ApiOperation({ summary: 'Update input, output, and model configurations' })
  updateSettings(@Body() body: SettingsUpdateRequestDto) {
    return this.settingsService.updateSettings(body);
  }

  @Get('fs/browse')
  @ApiOperation({ summary: 'Browse host filesystem directories and files for selection' })
  @ApiQuery({ name: 'path', required: false, type: String })
  @ApiQuery({ name: 'mode', required: false, enum: ['folder', 'file'] })
  browseDirectoryGet(@Query('path') targetPath?: string, @Query('mode') mode?: 'folder' | 'file') {
    return this.settingsService.browseDirectory(targetPath, mode);
  }

  @Post('fs/browse')
  @ApiOperation({ summary: 'Browse host filesystem directories and files via POST' })
  browseDirectoryPost(@Body() body: { path?: string; mode?: 'folder' | 'file' }) {
    return this.settingsService.browseDirectory(body?.path, body?.mode);
  }

  @Post('select-folder')
  @ApiOperation({ summary: 'Open native folder picker on the host system' })
  async selectFolder() {
    return this.settingsService.selectFolder();
  }

  @Post('select-file')
  @ApiOperation({ summary: 'Open native media file picker on the host system' })
  async selectFile() {
    return this.settingsService.selectFile();
  }
}
