export interface SettingsData {
  input_folders?: string[];
  output_folder?: string;
  default_output_folder?: string;
  is_custom_input?: boolean;
  is_custom_output?: boolean;
  is_dev?: boolean;
  model_provider?: string;
  gemini_model?: string;
  local_model_name?: string;
  gemini_max_workers?: number;
  local_max_workers?: number;
  max_workers?: number;
  whisper_model?: string;
  preserve_structure?: boolean;
  db_path?: string;
  [key: string]: unknown;
}

export interface UISettings {
  maxImagesPerRow: number;
  maxRows: number;
  maxWidth: number;
  galleryMaxRows?: number;
}
