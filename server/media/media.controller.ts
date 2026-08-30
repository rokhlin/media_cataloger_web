import { Controller, Get, Post, Body, Query, Res, BadRequestException, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { MediaService } from './media.service.js';
import { ThumbnailService } from './thumbnail.service.js';
import { AddPersonToFileDto, RemoveFaceFromFileDto, ListMediaFilesQueryDto } from './dto/media.dto.js';

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.avif':
      return 'image/avif';
    case '.heic':
    case '.heif':
      return 'image/heic';
    case '.mp4':
      return 'video/mp4';
    case '.mov':
      return 'video/quicktime';
    case '.avi':
      return 'video/x-msvideo';
    case '.mkv':
      return 'video/x-matroska';
    case '.webm':
      return 'video/webm';
    default:
      return 'application/octet-stream';
  }
}

function streamFileSafely(filePath: string, res: Response, mimeType?: string, cacheControl?: string): void {
  try {
    if (!fs.existsSync(filePath)) {
      if (!res.headersSent) {
        res.status(404).json({ error: 'file_not_found', path: filePath });
      }
      return;
    }
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      if (!res.headersSent) {
        res.status(400).json({ error: 'not_a_file', path: filePath });
      }
      return;
    }

    const type = mimeType || getMimeType(filePath);
    res.setHeader('Content-Type', type);
    res.setHeader('Content-Length', stat.size);
    if (cacheControl) {
      res.setHeader('Cache-Control', cacheControl);
    }
    const stream = fs.createReadStream(filePath);
    stream.on('error', (err) => {
      if (!res.headersSent) {
        res.status(500).json({ error: 'stream_error', detail: err.message });
      }
    });
    stream.pipe(res);
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: 'stream_exception', detail: err.message });
    }
  }
}

@ApiTags('media')
@Controller('api/media')
export class MediaController {
  constructor(
    @Inject(MediaService) private readonly mediaService: MediaService,
    @Inject(ThumbnailService) private readonly thumbnailService: ThumbnailService,
  ) {}

  @Get('files')
  @ApiOperation({ summary: 'List all media files discovered in input sources with pagination, search, filter and sorting' })
  @ApiResponse({ status: 200, description: 'Media file list with face detections, pagination and AI summaries' })
  async listMediaFiles(@Query() query: ListMediaFilesQueryDto) {
    return this.mediaService.listMediaFiles(query);
  }

  @Get('scan-status')
  @ApiOperation({ summary: 'Get real-time folder scanning and indexing status with current file' })
  async getScanStatus() {
    return this.mediaService.getScanStatus();
  }

  @Get('thumbnail')
  @ApiOperation({ summary: 'Get or generate a fast cached WebP thumbnail for a media file' })
  @ApiQuery({ name: 'path', required: false, description: 'Full path or relative path to media file' })
  @ApiQuery({ name: 'file', required: false, description: 'Filename or subpath to media file' })
  @ApiQuery({ name: 'size', required: false, description: 'Max thumbnail dimension in pixels (default 300)' })
  async getThumbnail(
    @Query('path') queryPath: string,
    @Query('file') queryFile: string,
    @Query('size') querySize: string,
    @Res() res: Response,
  ) {
    const target = queryPath || queryFile;
    if (!target || !target.trim()) {
      throw new BadRequestException('Missing file or path parameter');
    }
    const resolved = this.mediaService.resolveMediaFilePath(target);
    const size = querySize ? parseInt(querySize, 10) : 300;

    try {
      const thumb = await this.thumbnailService.getThumbnail(resolved, size);
      streamFileSafely(thumb.filePath, res, 'image/webp', 'public, max-age=31536000, immutable');
    } catch {
      // If thumbnail generation is not possible (e.g. video or unsupported format), fallback to original file
      streamFileSafely(resolved, res);
    }
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
    streamFileSafely(resolved, res);
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
    streamFileSafely(resolved, res);
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
