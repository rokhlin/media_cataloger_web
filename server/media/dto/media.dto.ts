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
