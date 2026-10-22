import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class RenameFaceDto {
  @ApiProperty({ description: 'Face ID in registry to rename', example: 'FACE_ID_01' })
  @IsString()
  @IsNotEmpty()
  face_id: string;

  @ApiProperty({ description: 'New human-readable name', example: 'Alex' })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class AssignFaceDto {
  @ApiProperty({ description: 'Face ID to assign to person', example: 'FACE_ID_01' })
  @IsString()
  @IsNotEmpty()
  face_id: string;

  @ApiProperty({ description: 'Person name', example: 'Alex' })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class AssignGroupDto {
  @ApiProperty({ description: 'Array of Face IDs to assign to person', example: ['FACE_01', 'FACE_02'] })
  @IsArray()
  @IsNotEmpty()
  face_ids: string[];

  @ApiProperty({ description: 'Person name', example: 'Alex' })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class ResetFaceDto {
  @ApiProperty({ description: 'Face ID to reset back to unassigned candidate', example: 'FACE_ID_01' })
  @IsString()
  @IsNotEmpty()
  face_id: string;
}

export class ResetFaceByFilenameDto {
  @ApiProperty({ description: 'Filename or path of media whose faces to reset', example: 'photo.jpg' })
  @IsString()
  @IsNotEmpty()
  filename: string;
}

export class DeleteFaceDto {
  @ApiProperty({ description: 'Face ID to permanently delete from registry', example: 'FACE_ID_01' })
  @IsString()
  @IsNotEmpty()
  face_id: string;
}

export class DeleteFacesBatchDto {
  @ApiProperty({ description: 'Array of Face IDs to permanently delete', example: ['FACE_01', 'FACE_02'] })
  @IsArray()
  @IsNotEmpty()
  face_ids: string[];
}

export class RejectAssignmentDto {
  @ApiProperty({ description: 'Face ID whose recognition assignment is rejected', example: 'FACE_01' })
  @IsString()
  @IsNotEmpty()
  face_id: string;

  @ApiProperty({ description: 'Name of the incorrectly assigned person', required: false, example: 'Alex' })
  name?: string;

  @ApiProperty({ description: 'Source media file path', required: false, example: 'photos/family.jpg' })
  file_path?: string;
}

export class ResetPrimaryFaceDto {
  @ApiProperty({ description: 'Person ID or Name whose primary avatar is reset to default', required: false })
  person_id?: string;

  @ApiProperty({ description: 'Person Name', required: false })
  name?: string;
}

export class SetPrimaryFaceDto {
  @ApiProperty({ description: 'Person ID', required: false })
  person_id?: string;

  @ApiProperty({ description: 'Person Name', required: false })
  name?: string;

  @ApiProperty({ description: 'Face ID to set as primary reference avatar', example: 'FACE_01' })
  @IsString()
  @IsNotEmpty()
  face_id: string;
}

export class ManualCropFaceDto {
  @ApiProperty({ description: 'Person Name to associate with this cropped face', example: 'Alex' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Source media file path', required: false })
  file_path?: string;

  @ApiProperty({ description: 'Base64 data URL or raw base64 string of cropped face image', required: false })
  image_base64?: string;

  @ApiProperty({ description: 'Normalized bounding box [ymin, xmin, ymax, xmax]', required: false, type: [Number] })
  box?: number[];

  @ApiProperty({ description: 'Whether to set as primary face for this person', required: false, default: true })
  set_primary?: boolean;
}
