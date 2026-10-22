import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Inject,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { TagsService } from './tags.service.js';
import { CreateTagDto, RenameTagDto, AddMediaTagDto, SetPersonTagsDto } from './dto/tags.dto.js';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Public } from '../auth/auth.decorators.js';

@ApiTags('tags')
@Controller('api')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TagsController {
  constructor(@Inject(TagsService) private readonly tagsService: TagsService) {}

  @Public()
  @Get('tags')
  @ApiOperation({ summary: 'List all unique tags in catalog with counts and categories' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'sort', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getTags(
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('sort') sort?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.tagsService.getTags(
      search,
      category,
      sort,
      limit ? Number(limit) : undefined,
      offset ? Number(offset) : undefined,
    );
  }

  @Public()
  @Get('tags/catalog')
  @ApiOperation({ summary: 'Alias: List tags catalog' })
  async getTagsCatalog(
    @Query('search') search?: string,
    @Query('category') category?: string,
  ) {
    return this.tagsService.getTags(search, category);
  }

  @Public()
  @Post('tags')
  @ApiOperation({ summary: 'Create or register a global tag' })
  async createTag(@Body() body: CreateTagDto) {
    return this.tagsService.createTag(body.tag, body.category);
  }

  @Public()
  @Put('tags/rename')
  @ApiOperation({ summary: 'Alias: Rename or merge tag via body' })
  async renameTagBody(@Body() body: { old_tag?: string; tag?: string; new_tag?: string; target_tag?: string; category?: string }) {
    const oldTag = body.old_tag || body.tag || '';
    const newTag = body.new_tag || body.target_tag || oldTag;
    return this.tagsService.renameOrMergeTag(oldTag, newTag, body.category);
  }

  @Public()
  @Put('tags/:tag')
  @ApiOperation({ summary: 'Rename or deduplicating merge a tag across catalog' })
  async renameOrMergeTag(@Param('tag') tag: string, @Body() body: RenameTagDto) {
    return this.tagsService.renameOrMergeTag(tag, body.new_tag, body.category);
  }

  @Public()
  @Delete('tags')
  @ApiOperation({ summary: 'Alias: Delete tag via query parameter' })
  async deleteTagQuery(@Query('tag') tag: string) {
    return this.tagsService.deleteTag(tag);
  }

  @Public()
  @Delete('tags/:tag')
  @ApiOperation({ summary: 'Delete a tag globally across media files' })
  async deleteTag(@Param('tag') tag: string) {
    return this.tagsService.deleteTag(tag);
  }

  // Media tags
  @Public()
  @Get('media/:id/tags')
  @ApiOperation({ summary: 'Get tags for specific media item' })
  async getMediaTags(@Param('id') id: string) {
    return this.tagsService.getMediaTags(id);
  }

  @Public()
  @Post('media/:id/tags')
  @ApiOperation({ summary: 'Add a tag to specific media item' })
  async addMediaTag(@Param('id') id: string, @Body() body: AddMediaTagDto) {
    return this.tagsService.addMediaTag(id, body.tag, body.category);
  }

  @Public()
  @Delete('media/:id/tags/:tag')
  @ApiOperation({ summary: 'Remove a tag from specific media item' })
  async removeMediaTag(@Param('id') id: string, @Param('tag') tag: string) {
    return this.tagsService.removeMediaTag(id, tag);
  }

  // Person tags (FEAT-032)
  @Public()
  @Get('persons/:id/tags')
  @ApiOperation({ summary: 'Get tags for a person profile' })
  async getPersonTags(@Param('id') id: string) {
    return this.tagsService.getPersonTags(id);
  }

  @Public()
  @Put('persons/:id/tags')
  @ApiOperation({ summary: 'Set tags for a person and trigger auto-inheritance on recognized media' })
  async setPersonTags(@Param('id') id: string, @Body() body: SetPersonTagsDto) {
    return this.tagsService.setPersonTags(id, body.tags || []);
  }
}
