import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AddPersonToFileDto {
  @ApiProperty({ description: 'File path or filename of the media item', example: 'photos/vacation.jpg' })
  @IsString()
  @IsNotEmpty()
  file: string;

  @ApiProperty({ description: 'Name of the person to link to this media file', example: 'Alice Smith' })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class RemoveFaceFromFileDto {
  @ApiProperty({ description: 'File path or filename of the media item', example: 'photos/vacation.jpg' })
  @IsString()
  @IsNotEmpty()
  file: string;

  @ApiProperty({ description: 'Face ID to unlink from this file', example: 'face_123' })
  @IsString()
  @IsNotEmpty()
  face_id: string;
}

export class ListMediaFilesQueryDto {
  @ApiProperty({ required: false, description: 'Page offset (0-indexed)', example: 0 })
  offset?: number;

  @ApiProperty({ required: false, description: 'Max items per page/chunk', example: 50 })
  limit?: number;

  @ApiProperty({ required: false, description: 'Page number (1-indexed)', example: 1 })
  page?: number;

  @ApiProperty({ required: false, description: 'Search term for file name, description, person, or folder', example: 'beach' })
  search?: string;

  @ApiProperty({ required: false, enum: ['all', 'images', 'videos'], description: 'Media type filter' })
  type?: 'all' | 'images' | 'videos';

  @ApiProperty({ required: false, enum: ['all', 'PROCESSED', 'UNPROCESSED', 'PENDING'], description: 'Processing status filter' })
  status?: 'all' | 'PROCESSED' | 'UNPROCESSED' | 'PENDING';

  @ApiProperty({ required: false, enum: ['all', 'with_faces', 'no_faces', 'unassigned'], description: 'Face detection filter' })
  face_filter?: 'all' | 'with_faces' | 'no_faces' | 'unassigned';

  @ApiProperty({ required: false, description: 'Filter by person name', example: 'Alice' })
  person?: string;

  @ApiProperty({ required: false, description: 'Filter by folder subpath or base folder' })
  folder?: string;

  @ApiProperty({ required: false, enum: ['name', 'date', 'size', 'status', 'faces'], description: 'Field to sort by' })
  sort_by?: 'name' | 'date' | 'size' | 'status' | 'faces';

  @ApiProperty({ required: false, enum: ['asc', 'desc'], description: 'Sort direction' })
  sort_order?: 'asc' | 'desc';

  @ApiProperty({ required: false, description: 'Force refresh and bust scan cache', example: false })
  refresh?: boolean | string;
}

