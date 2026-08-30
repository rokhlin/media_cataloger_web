import { Controller, Get, Post, Body, Query, Res, BadRequestException, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { MediaService } from './media.service.js';
import { AddPersonToFileDto, RemoveFaceFromFileDto, ListMediaFilesQueryDto } from './dto/media.dto.js';

@ApiTags('media')
@Controller('api/media')
export class MediaController {
  constructor(@Inject(MediaService) private readonly mediaService: MediaService) {}

  @Get('files')
  @ApiOperation({ summary: 'List all media files discovered in input sources with pagination, search, filter and sorting' })
  @ApiResponse({ status: 200, description: 'Media file list with face detections, pagination and AI summaries' })
  async listMediaFiles(@Query() query: ListMediaFilesQueryDto) {
    return this.mediaService.listMediaFiles(query);
  }


  @Get('file')
  @ApiOperation({ summary: 'Stream/serve a raw media file directly' })
  @ApiQuery({ name: 'path', required: false, description: 'Full path or relative path to media file' })
  @ApiQuery({ name: 'file', required: false, description: 'Filename or subpath to media file' })
  async getMediaFile(
    @Query('path') queryPath: string,
    @Query('file') queryFile: string,
    @Res() res: Response,
  ) {
    const target = queryPath || queryFile;
    if (!target || !target.trim()) {
      throw new BadRequestException('Missing file or path parameter');
    }
    const resolved = this.mediaService.resolveMediaFilePath(target);
    res.sendFile(resolved, (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ error: 'file_send_error', detail: err.message });
      }
    });
  }

  @Get('file-content')
  @ApiOperation({ summary: 'Stream raw binary media content (API for backend engine processing)' })
  @ApiQuery({ name: 'path', required: false, description: 'Full path or relative path to media file' })
  @ApiQuery({ name: 'file', required: false, description: 'Filename or subpath to media file' })
  async getMediaFileContent(
    @Query('path') queryPath: string,
    @Query('file') queryFile: string,
    @Res() res: Response,
  ) {
    const target = queryPath || queryFile;
    if (!target || !target.trim()) {
      throw new BadRequestException('Missing file or path parameter');
    }
    const resolved = this.mediaService.resolveMediaFilePath(target);
    res.sendFile(resolved, (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ error: 'file_send_error', detail: err.message });
      }
    });
  }

  @Get('validate-file')
  @ApiOperation({ summary: 'Check if a media file is accessible by the host server' })
  @ApiQuery({ name: 'file', required: true })
  async validateFileAccess(@Query('file') file: string) {
    if (!file || !file.trim()) {
      throw new BadRequestException('Missing file parameter');
    }
    return this.mediaService.verifyFileAccess(file.trim());
  }

  @Get('sidecar')
  @ApiOperation({ summary: 'Get full sidecar JSON metadata for a media file' })
  @ApiQuery({ name: 'path', required: false })
  @ApiQuery({ name: 'file', required: false })
  async getMediaSidecar(
    @Query('path') queryPath: string,
    @Query('file') queryFile: string,
  ) {
    const target = queryPath || queryFile;
    if (!target || !target.trim()) {
      throw new BadRequestException('Missing file or path parameter');
    }
    return this.mediaService.getMediaSidecar(target);
  }

  @Get('faces-for-file')
  @ApiOperation({ summary: 'Get all face detections and bounding boxes for a specific media file' })
  @ApiQuery({ name: 'file', required: true, description: 'Filename or path to the media file' })
  async getFacesForFile(@Query('file') file: string) {
    return this.mediaService.getFacesForFile(file);
  }

  @Post('add-person')
  @ApiOperation({ summary: 'Add or link a person to a media file' })
  async addPersonToFile(@Body() body: AddPersonToFileDto) {
    return this.mediaService.addPersonToFile(body.file, body.name);
  }

  @Post('remove-face')
  @ApiOperation({ summary: 'Remove or unlink a face/person from a media file' })
  async removeFaceFromFile(@Body() body: RemoveFaceFromFileDto) {
    return this.mediaService.removeFaceFromFile(body.file, body.face_id);
  }
}
