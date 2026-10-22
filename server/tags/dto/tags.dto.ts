import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTagDto {
  @ApiProperty({ description: 'Name of the tag', example: 'горы' })
  @IsString()
  @IsNotEmpty()
  tag: string;

  @ApiProperty({ description: 'Category', required: false, default: 'general', example: 'nature' })
  @IsString()
  @IsOptional()
  category?: string;
}

export class RenameTagDto {
  @ApiProperty({ description: 'New name for the tag (or existing tag to merge into)', example: 'горы' })
  @IsString()
  @IsNotEmpty()
  new_tag: string;

  @ApiProperty({ description: 'Updated category', required: false, example: 'nature' })
  @IsString()
  @IsOptional()
  category?: string;
}

export class AddMediaTagDto {
  @ApiProperty({ description: 'Tag string to assign', example: 'семья' })
  @IsString()
  @IsNotEmpty()
  tag: string;

  @ApiProperty({ description: 'Category', required: false, default: 'general', example: 'people' })
  @IsString()
  @IsOptional()
  category?: string;
}

export class SetPersonTagsDto {
  @ApiProperty({
    description: 'Array of tag items to assign to person',
    example: [{ tag: 'семья', category: 'people' }, { tag: 'родители', category: 'people' }]
  })
  tags: Array<{ tag: string; category?: string }>;
}
