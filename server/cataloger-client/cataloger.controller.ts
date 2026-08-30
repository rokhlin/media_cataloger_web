import { Controller, Get, Post, Delete, Query, Body, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { CatalogerClientService } from './cataloger.service.js';

@ApiTags('pipeline')
@Controller('api')
export class CatalogerController {
  constructor(@Inject(CatalogerClientService) private readonly catalogerService: CatalogerClientService) {}

  @Post('run')
  @ApiOperation({ summary: 'Trigger full cataloging sync' })
  @ApiQuery({ name: 'force', required: false, type: Boolean, description: 'Force re-processing of already synced items' })
  async triggerRun(@Query('force') force?: string, @Body() customPayload?: any) {
    try {
      const forceBool = force === 'true' || force === '1';
      return await this.catalogerService.triggerRun(forceBool, customPayload);
    } catch (err: any) {
      if (err instanceof HttpException) {
        throw err;
      }
      throw new HttpException(err.message, HttpStatus.BAD_GATEWAY);
    }
  }

  @Post('analyze-file')
  @ApiOperation({ summary: 'Analyze a single media file immediately' })
  @ApiQuery({ name: 'file', required: false, description: 'Filename or path to the media file' })
  async triggerAnalyzeFile(@Query('file') file?: string, @Body() body?: any) {
    const targetFile = file || body?.file;
    if (!targetFile || !String(targetFile).trim()) {
      throw new HttpException('File parameter cannot be empty.', HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.catalogerService.triggerAnalyzeFile(String(targetFile).trim(), body);
    } catch (err: any) {
      if (err instanceof HttpException) {
        throw err;
      }
      throw new HttpException(err.message, HttpStatus.BAD_GATEWAY);
    }
  }

  @Post('pause')
  @ApiOperation({ summary: 'Pause current pipeline execution' })
  async pause() {
    try {
      return await this.catalogerService.pause();
    } catch (err: any) {
      throw new HttpException(err.message, HttpStatus.BAD_GATEWAY);
    }
  }

  @Post('resume')
  @ApiOperation({ summary: 'Resume paused execution' })
  async resume() {
    try {
      return await this.catalogerService.resume();
    } catch (err: any) {
      throw new HttpException(err.message, HttpStatus.BAD_GATEWAY);
    }
  }

  @Post('stop')
  @ApiOperation({ summary: 'Stop and cancel current execution' })
  async stop() {
    try {
      return await this.catalogerService.stop();
    } catch (err: any) {
      throw new HttpException(err.message, HttpStatus.BAD_GATEWAY);
    }
  }

  @Get('status')
  @ApiOperation({ summary: 'Get current cataloging pipeline execution status and progress' })
  @ApiResponse({ status: 200, description: 'Current worker status and progress' })
  async getStatus() {
    return this.catalogerService.getStatus();
  }

  @Get('validate-connection')
  @ApiOperation({ summary: 'Validate HTTP connection to media_cataloger AI service' })
  @ApiResponse({ status: 200, description: 'Connection status and latency details' })
  async validateConnection() {
    return this.catalogerService.validateConnection();
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check and connection validation for cataloger AI service' })
  async getHealth() {
    return this.catalogerService.validateConnection();
  }

  @Get('logs')
  @ApiOperation({ summary: 'Get real-time execution logs from cataloging worker' })
  async getLogs() {
    return this.catalogerService.getLogs();
  }

  @Post('logs/clear')
  @Delete('logs')
  @ApiOperation({ summary: 'Clear execution logs' })
  async clearLogs() {
    return this.catalogerService.clearLogs();
  }
}
