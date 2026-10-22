import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsNumber, IsBoolean } from 'class-validator';

export class SettingsUpdateRequestDto {
  @ApiPropertyOptional({ description: 'List of input media directories', example: ['/app/media_input', 'D:/Photos'] })
  @IsOptional()
  @IsArray()
  input_folders?: string[];

  @ApiPropertyOptional({ description: 'Output directory for database and metadata sidecars', example: '/app/media_output' })
  @IsOptional()
  @IsString()
  output_folder?: string;

  @ApiPropertyOptional({ description: 'Active Model Provider (gemini / local)', example: 'gemini' })
  @IsOptional()
  @IsString()
  model_provider?: string;

  @ApiPropertyOptional({ description: 'Gemini Model Name', example: 'gemini-3.8-flash' })
  @IsOptional()
  @IsString()
  gemini_model?: string;

  @ApiPropertyOptional({ description: 'Google Gemini API Key for backend model operations' })
  @IsOptional()
  @IsString()
  gemini_api_key?: string;

  @ApiPropertyOptional({ description: 'Explicitly remove configured Gemini API Key', example: false })
  @IsOptional()
  @IsBoolean()
  clear_gemini_api_key?: boolean;

  @ApiPropertyOptional({ description: 'Gemini rate limit in requests per minute (RPM)', example: 15 })
  @IsOptional()
  @IsNumber()
  rpm_limit?: number;

  @ApiPropertyOptional({ description: 'Local Model Name', example: 'qwen2.5-vl-7b-instruct' })
  @IsOptional()
  @IsString()
  local_model_name?: string;

  @ApiPropertyOptional({ description: 'Gemini Maximum Parallel Workers', example: 3 })
  @IsOptional()
  @IsNumber()
  gemini_max_workers?: number;

  @ApiPropertyOptional({ description: 'Local Model Maximum Parallel Workers', example: 2 })
  @IsOptional()
  @IsNumber()
  local_max_workers?: number;

  @ApiPropertyOptional({ description: 'Whisper Model Name', example: 'large-v3-turbo' })
  @IsOptional()
  @IsString()
  whisper_model?: string;

  @ApiPropertyOptional({ description: 'Preserve folder structure in output', example: true })
  @IsOptional()
  @IsBoolean()
  preserve_structure?: boolean;

  @ApiPropertyOptional({ description: 'Vision prompt template with placeholders' })
  @IsOptional()
  @IsString()
  vision_prompt_template?: string;

  @ApiPropertyOptional({ description: 'Public/LAN URL of Media Cataloger Web for distributed AI Engine file streaming', example: 'http://192.168.8.13:8000' })
  @IsOptional()
  @IsString()
  ui_public_url?: string;

  @ApiPropertyOptional({ description: 'Automatic fallback to Gemini when LM Studio is unavailable', example: true })
  @IsOptional()
  @IsBoolean()
  ai_gemini_fallback_enabled?: boolean;

  @ApiPropertyOptional({ description: 'Alias for ai_gemini_fallback_enabled', example: true })
  @IsOptional()
  @IsBoolean()
  fallback_to_gemini?: boolean;

  @ApiPropertyOptional({ description: 'AI Media Analysis Provider (gemini / local)', example: 'gemini' })
  @IsOptional()
  @IsString()
  ai_analysis_provider?: string;

  @ApiPropertyOptional({ description: 'AI Media Analysis Model', example: 'gemini-3.8-flash' })
  @IsOptional()
  @IsString()
  ai_analysis_model?: string;

  @ApiPropertyOptional({ description: 'AI Media Analysis Fallback to Gemini', example: true })
  @IsOptional()
  @IsBoolean()
  ai_analysis_fallback_enabled?: boolean;

  @ApiPropertyOptional({ description: 'AI Media Analysis Max Parallel Workers', example: 3 })
  @IsOptional()
  @IsNumber()
  ai_analysis_max_workers?: number;

  @ApiPropertyOptional({ description: 'AI Image Editing Provider (gemini / local)', example: 'gemini' })
  @IsOptional()
  @IsString()
  ai_editing_provider?: string;

  @ApiPropertyOptional({ description: 'AI Image Editing Model', example: 'gemini-nano-banana' })
  @IsOptional()
  @IsString()
  ai_editing_model?: string;

  @ApiPropertyOptional({ description: 'AI Image Editing Fallback to Gemini', example: true })
  @IsOptional()
  @IsBoolean()
  ai_editing_fallback_enabled?: boolean;

  @ApiPropertyOptional({ description: 'AI Image Editing Default Style Strength (0.1 - 1.0)', example: 0.40 })
  @IsOptional()
  @IsNumber()
  ai_editing_style_strength?: number;

  @ApiPropertyOptional({ description: 'Preserve facial features in AI Image Editing', example: true })
  @IsOptional()
  @IsBoolean()
  ai_editing_preserve_faces?: boolean;

  @ApiPropertyOptional({ description: 'Nested AI Analysis configuration object' })
  @IsOptional()
  ai_analysis?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Nested AI Editing configuration object' })
  @IsOptional()
  ai_editing?: Record<string, any>;
}

