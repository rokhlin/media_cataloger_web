import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

export interface NormalizePathOptions {
  isDev?: boolean;
  fallbackType?: 'input' | 'output';
}

export function toContainerPath(p: string, fallbackType: 'input' | 'output' = 'input'): string {
  const base = fallbackType === 'output' ? '/app/media_output' : '/app/media_input';
  if (!p) return base;
  let cleaned = p.trim().replace(/\\/g, '/');

  // If Windows drive root like Z:\ or C:\ or Z:
  if (/^[a-zA-Z]:\/?$/.test(cleaned)) {
    return base;
  }
  cleaned = cleaned.replace(/^[a-zA-Z]:\/?/, '');

  // Strip UNC host and share prefixes (e.g. //server/share or //server/share/Photo)
  if (cleaned.startsWith('//') || (p.trim().startsWith('\\') || p.trim().startsWith('//'))) {
    const parts = cleaned.replace(/^\/+/, '').split('/').filter(Boolean);
    if (parts.length <= 3) {
      return base;
    }
    cleaned = parts.slice(3).join('/');
  }

  // Strip leading slashes
  cleaned = cleaned.replace(/^\/+/, '');

  if (!cleaned) return base;
  if (
    cleaned.startsWith('app/media_input') ||
    cleaned.startsWith('/app/media_input') ||
    cleaned.startsWith('app/media_output') ||
    cleaned.startsWith('/app/media_output')
  ) {
    return '/' + cleaned.replace(/^\/+/, '');
  }
  return path.posix.join(base, cleaned);
}

export function normalizeConfigPath(
  p: string,
  baseDir: string,
  options?: NormalizePathOptions
): string {
  if (!p) return '';
  const trimmed = p.trim();
  if (!trimmed) return '';

  const isDev = options?.isDev !== undefined
    ? options.isDev
    : (process.env.BUILD_TYPE === 'dev' || (process.env.BUILD_TYPE !== 'production' && process.env.BUILD_TYPE !== 'docker' && process.env.NODE_ENV !== 'production'));
  const fallbackType = options?.fallbackType || 'input';

  const isUnc = trimmed.startsWith('\\') || trimmed.startsWith('//');
  const isWinDrive = /^[a-zA-Z]:[/\\]/.test(trimmed);

  // In non-dev builds (e.g. docker/production), UNC share mounts and Windows drive paths are mapped to container mount points
  if (!isDev && (isUnc || isWinDrive)) {
    const lower = trimmed.toLowerCase();
    const effectiveType = (fallbackType === 'output' || lower.includes('output') || lower.includes('cataloger') || lower.includes('sda1'))
      ? 'output'
      : 'input';
    return toContainerPath(trimmed, effectiveType);
  }

  // Check if Windows UNC path (e.g. \\server\share or //server/share)
  if (isUnc) {
    return trimmed;
  }

  // Check if Windows drive letter (e.g. C:\... or C:/...)
  if (isWinDrive) {
    return trimmed;
  }

  // Check if POSIX root-based absolute path
  if (trimmed.startsWith('/')) {
    return path.normalize(trimmed);
  }

  // If already absolute according to path.isAbsolute
  if (path.isAbsolute(trimmed)) {
    return path.normalize(trimmed);
  }

  // Relative path -> resolve against baseDir
  return path.resolve(baseDir, trimmed);
}

export function joinConfigPaths(base: string, ...segments: string[]): string {
  if (!base) return path.join(...segments);
  const trimmedBase = base.trim();

  // If base starts with '/' (POSIX container path like /app/media_output), join with forward slashes
  if (trimmedBase.startsWith('/')) {
    const cleanSegments = segments.map(s => s.replace(/^[/\\]+/, '').replace(/[/\\]+$/, '').replace(/\\/g, '/'));
    return [trimmedBase.replace(/[/\\]+$/, ''), ...cleanSegments].join('/');
  }

  // If base uses backslashes (Windows UNC or Windows path)
  if (trimmedBase.startsWith('\\') || /^[a-zA-Z]:[\\\/]/.test(trimmedBase) || trimmedBase.includes('\\')) {
    const cleanSegments = segments.map(s => s.replace(/^[/\\]+/, '').replace(/[/\\]+$/, '').replace(/\//g, '\\'));
    return [trimmedBase.replace(/[\\]+$/, ''), ...cleanSegments].join('\\');
  }

  return path.join(trimmedBase, ...segments);
}

// Load .env and .env.local if present in current directory, config directory, or parent directory
const possibleEnvFiles = [
  process.env.ENV_FILE ? path.resolve(process.env.ENV_FILE) : '',
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'data', 'config', '.env.local'),
  path.resolve(process.cwd(), 'data', 'config', '.env'),
  path.resolve(process.cwd(), '..', '.env.local'),
  path.resolve(process.cwd(), '..', '.env'),
  path.resolve(process.cwd(), '..', 'data', 'config', '.env.local'),
  path.resolve(process.cwd(), '..', 'data', 'config', '.env'),
].filter(Boolean);

for (const envFile of possibleEnvFiles) {
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
    break;
  }
}

// Detect project root safely for standalone or mono-repo layout
let projectRoot = process.cwd();
if (fs.existsSync(path.resolve(process.cwd(), 'manage.py'))) {
  projectRoot = process.cwd();
} else if (fs.existsSync(path.resolve(process.cwd(), '..', 'manage.py'))) {
  projectRoot = path.resolve(process.cwd(), '..');
}

@Injectable()
export class AppConfigService {
  readonly projectRoot: string = projectRoot;

  get isDev(): boolean {
    if (process.env.BUILD_TYPE === 'dev' || process.env.BUILD_TYPE === 'development') return true;
    if (process.env.BUILD_TYPE === 'production' || process.env.BUILD_TYPE === 'docker') return false;
    return process.env.NODE_ENV !== 'production';
  }

  get port(): number {
    if (process.env.WEB_PORT) {
      return parseInt(process.env.WEB_PORT, 10);
    }
    if (process.env.PORT) {
      return parseInt(process.env.PORT, 10);
    }
    return 8000;
  }

  get catalogerApiUrl(): string {
    if (process.env.CATALOGER_API_URL) {
      return process.env.CATALOGER_API_URL;
    }
    if (process.env.AI_ENGINE_URL) {
      return process.env.AI_ENGINE_URL;
    }
    if (process.env.API_PORT && String(process.env.API_PORT) !== String(this.port)) {
      const host = process.env.API_HOST === '0.0.0.0' ? 'localhost' : (process.env.API_HOST || 'localhost');
      return `http://${host}:${process.env.API_PORT}`;
    }
    return 'http://localhost:8001';
  }

  get settingsFilePath(): string {
    if (process.env.SETTINGS_PATH && process.env.SETTINGS_PATH.trim()) {
      return path.resolve(process.env.SETTINGS_PATH.trim());
    }
    if (process.env.CONFIG_PATH && process.env.CONFIG_PATH.trim()) {
      return path.resolve(process.env.CONFIG_PATH.trim(), 'settings.json');
    }
    return path.resolve(this.projectRoot, 'data', 'config', 'settings.json');
  }

  ensureFeatureFlagsFile(): string {
    const rootDataPath = path.resolve(this.projectRoot, 'data', 'feature_flags.json');
    if (!fs.existsSync(rootDataPath)) {
      const candidates = [
        path.resolve(this.projectRoot, 'assets', 'default-feature-flags.json'),
        path.resolve(this.projectRoot, 'src', 'assets', 'default-feature-flags.json'),
        path.resolve(process.cwd(), 'assets', 'default-feature-flags.json'),
        path.resolve(process.cwd(), 'src', 'assets', 'default-feature-flags.json'),
      ];
      const source = candidates.find((p) => fs.existsSync(p));
      if (source) {
        try {
          const dir = path.dirname(rootDataPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.copyFileSync(source, rootDataPath);
        } catch (err: any) {
          console.warn(`[AppConfigService] Failed to copy default feature flags from ${source} to ${rootDataPath}:`, err.message);
        }
      }
    }
    return this.featureFlagsFilePath;
  }

  get featureFlagsFilePath(): string {
    if (process.env.FEATURE_FLAGS_PATH && process.env.FEATURE_FLAGS_PATH.trim()) {
      return path.resolve(process.env.FEATURE_FLAGS_PATH.trim());
    }
    const rootDataPath = path.resolve(this.projectRoot, 'data', 'feature_flags.json');
    if (fs.existsSync(rootDataPath)) {
      return rootDataPath;
    }
    const configDirPath = process.env.CONFIG_PATH && process.env.CONFIG_PATH.trim()
      ? path.resolve(process.env.CONFIG_PATH.trim())
      : path.resolve(this.projectRoot, 'data', 'config');
    const inConfigPath = path.resolve(configDirPath, 'feature_flags.json');
    if (fs.existsSync(inConfigPath)) {
      return inConfigPath;
    }
    return rootDataPath;
  }

  getSavedSettings(): Record<string, any> {
    const configPath = this.settingsFilePath;
    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }
    const legacyPath = path.resolve(this.projectRoot, 'settings.json');
    if (fs.existsSync(legacyPath)) {
      try {
        const raw = fs.readFileSync(legacyPath, 'utf-8');
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }
    return {};
  }

  saveSettings(inputFolders?: string[], outputFolder?: string, additionalSettings?: Record<string, any>): void {
    const existing = this.getSavedSettings();
    const data: Record<string, any> = {
      ...existing,
      ...(additionalSettings || {}),
      updated_at: new Date().toISOString(),
    };
    if (inputFolders !== undefined) {
      if (inputFolders.length > 0) {
        data.INPUT_FOLDERS = inputFolders;
      } else {
        delete data.INPUT_FOLDERS;
        delete data.input_folders;
      }
    }
    if (outputFolder !== undefined) {
      if (outputFolder.trim()) {
        data.OUTPUT_FOLDER = outputFolder.trim();
      } else {
        delete data.OUTPUT_FOLDER;
        delete data.output_folder;
      }
    }
    const targetFile = this.settingsFilePath;
    const targetDir = path.dirname(targetFile);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.writeFileSync(targetFile, JSON.stringify(data, null, 2), 'utf-8');
  }

  get inputFolders(): string[] {
    const saved = this.getSavedSettings();
    const savedInputs = saved.INPUT_FOLDERS || saved.input_folders;
    if (savedInputs && Array.isArray(savedInputs) && savedInputs.length > 0) {
      return savedInputs.map(p => normalizeConfigPath(String(p), this.projectRoot, { isDev: this.isDev, fallbackType: 'input' }));
    }
    const envInputs = process.env.INPUT_FOLDERS || process.env.MEDIA_INPUT;
    if (envInputs && envInputs.trim()) {
      return envInputs.split(',').map(p => p.trim()).filter(Boolean).map(p => normalizeConfigPath(p, this.projectRoot, { isDev: this.isDev, fallbackType: 'input' }));
    }
    return [this.isDev ? normalizeConfigPath('media_input', this.projectRoot, { isDev: true }) : '/app/media_input'];
  }

  get outputFolder(): string {
    const saved = this.getSavedSettings();
    const savedOutput = saved.OUTPUT_FOLDER || saved.output_folder;
    if (savedOutput && String(savedOutput).trim()) {
      return normalizeConfigPath(String(savedOutput).trim(), this.projectRoot, { isDev: this.isDev, fallbackType: 'output' });
    }
    const envOutput = process.env.OUTPUT_FOLDER || process.env.MEDIA_OUTPUT;
    if (envOutput && envOutput.trim()) {
      return normalizeConfigPath(envOutput.trim(), this.projectRoot, { isDev: this.isDev, fallbackType: 'output' });
    }
    return this.isDev ? normalizeConfigPath('media_output', this.projectRoot, { isDev: true }) : '/app/media_output';
  }

  get dbPath(): string {
    if (process.env.DB_PATH && process.env.DB_PATH.trim()) {
      return normalizeConfigPath(process.env.DB_PATH.trim(), this.projectRoot, { isDev: this.isDev, fallbackType: 'output' });
    }
    const saved = this.getSavedSettings();
    const savedOutput = saved.OUTPUT_FOLDER || saved.output_folder;
    if (savedOutput && String(savedOutput).trim()) {
      const out = normalizeConfigPath(String(savedOutput).trim(), this.projectRoot, { isDev: this.isDev, fallbackType: 'output' });
      const rootDb = joinConfigPaths(out, 'catalog_history.db');
      if (fs.existsSync(rootDb)) return rootDb;
      return joinConfigPaths(out, 'config', 'catalog_history.db');
    }
    if (process.env.OUTPUT_FOLDER && process.env.OUTPUT_FOLDER.trim()) {
      const out = normalizeConfigPath(process.env.OUTPUT_FOLDER.trim(), this.projectRoot, { isDev: this.isDev, fallbackType: 'output' });
      const rootDb = joinConfigPaths(out, 'catalog_history.db');
      if (fs.existsSync(rootDb)) return rootDb;
      return joinConfigPaths(out, 'config', 'catalog_history.db');
    }
    const legacyRootDb = joinConfigPaths(this.outputFolder, 'catalog_history.db');
    if (fs.existsSync(legacyRootDb)) return legacyRootDb;
    return joinConfigPaths(this.outputFolder, 'config', 'catalog_history.db');
  }

  get familyTreeDbPath(): string {
    if (process.env.FAMILY_TREE_DB_PATH && process.env.FAMILY_TREE_DB_PATH.trim()) {
      return normalizeConfigPath(process.env.FAMILY_TREE_DB_PATH.trim(), this.projectRoot, { isDev: this.isDev, fallbackType: 'output' });
    }
    const saved = this.getSavedSettings();
    const savedOutput = saved.OUTPUT_FOLDER || saved.output_folder;
    if (savedOutput && String(savedOutput).trim()) {
      const out = normalizeConfigPath(String(savedOutput).trim(), this.projectRoot, { isDev: this.isDev, fallbackType: 'output' });
      return joinConfigPaths(out, 'family_tree.db');
    }
    if (process.env.OUTPUT_FOLDER && process.env.OUTPUT_FOLDER.trim()) {
      const out = normalizeConfigPath(process.env.OUTPUT_FOLDER.trim(), this.projectRoot, { isDev: this.isDev, fallbackType: 'output' });
      return joinConfigPaths(out, 'family_tree.db');
    }
    return joinConfigPaths(this.outputFolder, 'family_tree.db');
  }

  get facesFolder(): string {
    if (process.env.FACES_FOLDER && process.env.FACES_FOLDER.trim()) {
      return normalizeConfigPath(process.env.FACES_FOLDER.trim(), this.projectRoot, { isDev: this.isDev, fallbackType: 'output' });
    }
    const facessCandidate = joinConfigPaths(this.outputFolder, 'facess');
    if (fs.existsSync(facessCandidate)) {
      return facessCandidate;
    }
    const facesCandidate = joinConfigPaths(this.outputFolder, 'faces');
    if (fs.existsSync(facesCandidate)) {
      return facesCandidate;
    }
    return facessCandidate;
  }

  get supportedPhotoExts(): Set<string> {
    return new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.raw', '.arw', '.cr2', '.nef', '.dng', '.tiff', '.bmp']);
  }

  get supportedVideoExts(): Set<string> {
    return new Set(['.mp4', '.mov', '.avi', '.mkv', '.wmv', '.m4v', '.webm', '.flv', '.3gp']);
  }

  /**
   * Export the active execution configuration to pass to the BE pipeline worker.
   * UI is the single source of truth for all runtime settings and output paths.
   */
  getPipelineExecutionConfig(): Record<string, any> {
    const saved = this.getSavedSettings();
    return {
      output_folder: this.outputFolder,
      model_provider: saved.MODEL_PROVIDER || process.env.MODEL_PROVIDER || 'gemini',
      gemini_model: saved.GEMINI_MODEL || process.env.GEMINI_MODEL || 'gemini-3.6-flash',
      local_model_name: saved.LOCAL_MODEL_NAME || process.env.LOCAL_MODEL_NAME || '',
      gemini_max_workers: saved.GEMINI_MAX_WORKERS ? Number(saved.GEMINI_MAX_WORKERS) : Number(process.env.GEMINI_MAX_WORKERS || 3),
      local_max_workers: saved.LOCAL_MAX_WORKERS ? Number(saved.LOCAL_MAX_WORKERS) : Number(process.env.LOCAL_MAX_WORKERS || 2),
      whisper_model: saved.WHISPER_MODEL || process.env.WHISPER_MODEL || 'large-v3-turbo',
      preserve_structure: saved.PRESERVE_STRUCTURE !== undefined ? Boolean(saved.PRESERVE_STRUCTURE) : true,
      ui_base_url: process.env.UI_PUBLIC_URL || `http://localhost:${this.port}`,
    };
  }
}

