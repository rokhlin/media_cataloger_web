import { Controller, Get, Post, Body, Param, Query, Res, Inject, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import axios from 'axios';
import { FacesService } from './faces.service.js';
import {
  RenameFaceDto,
  AssignFaceDto,
  AssignGroupDto,
  ResetFaceDto,
  ResetFaceByFilenameDto,
  DeleteFaceDto,
} from './dto/faces.dto.js';

@ApiTags('faces')
@Controller('api/faces')
export class FacesController {
  constructor(@Inject(FacesService) private readonly facesService: FacesService) {}

  @Get()
  @ApiOperation({ summary: 'List all registered faces in the database' })
  async listFaces() {
    return this.facesService.getAllRegisteredFaces();
  }

  @Get('persons')
  @ApiOperation({ summary: 'List known persons with reference face collections and media counts' })
  async listKnownPersons() {
    return this.facesService.getKnownPersons();
  }

  @Get('unrecognized')
  @ApiOperation({ summary: 'List unrecognized face crops waiting for user labeling' })
  async listUnrecognizedFaces() {
    return this.facesService.getUnrecognizedFaces();
  }

  @Get('unrecognized-groups')
  @ApiOperation({ summary: 'List unrecognized faces clustered into similarity groups' })
  @ApiQuery({ name: 'threshold', required: false, type: Number })
  async listUnrecognizedGroups(@Query('threshold') threshold?: number) {
    return this.facesService.getUnrecognizedGroups(threshold ? Number(threshold) : undefined);
  }

  @Get('groups')
  @ApiOperation({ summary: 'Alias for unrecognized face similarity groups' })
  @ApiQuery({ name: 'threshold', required: false, type: Number })
  async listFaceGroups(@Query('threshold') threshold?: number) {
    return this.facesService.getUnrecognizedGroups(threshold ? Number(threshold) : undefined);
  }

  @Get('image/:filename')
  @ApiOperation({ summary: 'Serve cropped face thumbnail image' })
  async getFaceImage(@Param('filename') filename: string, @Res() res: Response) {
    try {
      const resolved = this.facesService.getFaceImagePath(filename);
      return res.sendFile(resolved);
    } catch {
      // Proxy fallback from remote cataloger backend if face image is on the worker daemon
      try {
        const baseUrl = this.facesService.catalogerApiUrl;
        const remoteUrl = `${baseUrl}/api/faces/image/${encodeURIComponent(filename)}`;
        const response = await axios.get(remoteUrl, { responseType: 'stream', timeout: 5000 });
        if (response.headers['content-type']) {
          res.setHeader('Content-Type', String(response.headers['content-type']));
        }
        return response.data.pipe(res);
      } catch {
        throw new NotFoundException(`Face image '${filename}' not found`);
      }
    }
  }

  @Post('rename')
  @ApiOperation({ summary: 'Rename a face registry entry or person' })
  async renameFace(@Body() body: RenameFaceDto) {
    return this.facesService.renameFace(body.face_id, body.name);
  }

  @Post('assign')
  @ApiOperation({ summary: 'Assign an unrecognized face to a known or new person' })
  async assignFace(@Body() body: AssignFaceDto) {
    return this.facesService.assignFace(body.face_id, body.name);
  }

  @Post('assign-group')
  @ApiOperation({ summary: 'Assign a group/cluster of similar faces to a person' })
  async assignGroup(@Body() body: AssignGroupDto) {
    return this.facesService.assignGroup(body.face_ids, body.name);
  }

  @Post('reset')
  @ApiOperation({ summary: 'Reset a face assignment back to unassigned candidate' })
  async resetFace(@Body() body: ResetFaceDto) {
    return this.facesService.resetFace(body.face_id);
  }

  @Post('reset-by-filename')
  @ApiOperation({ summary: 'Reset all face assignments for a specific filename' })
  async resetFacesByFilename(@Body() body: ResetFaceByFilenameDto) {
    return this.facesService.resetFacesByFilename(body.filename);
  }

  @Post('reset-by-file')
  @ApiOperation({ summary: 'Alias for reset-by-filename' })
  async resetFacesByFile(@Body() body: ResetFaceByFilenameDto) {
    return this.facesService.resetFacesByFilename(body.filename);
  }

  @Post('delete')
  @ApiOperation({ summary: 'Delete a face entry from the registry' })
  async deleteFace(@Body() body: DeleteFaceDto) {
    return this.facesService.deleteFace(body.face_id);
  }
}
