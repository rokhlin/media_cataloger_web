import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

export function normalizeConfigPath(p: string, baseDir: string): string {
  if (!p) return '';
  const trimmed = p.trim();
  if (!trimmed) return '';

  // Check if Windows UNC path (e.g. \\server\share or //server/share)
  if (trimmed.startsWith('\\\\') || trimmed.startsWith('//')) {
    return trimmed;
  }

  // Check if Windows drive letter (e.g. C:\... or C:/...)
  if (/^[a-zA-Z]:[/\\]/.test(trimmed)) {
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

  // If base uses backslashes (Windows UNC or Windows path)
  if (trimmedBase.startsWith('\\\\') || /^[a-zA-Z]:[\\\/]/.test(trimmedBase) || trimmedBase.includes('\\')) {
    const cleanSegments = segments.map(s => s.replace(/^[/\\]+/, '').replace(/[/\\]+$/, '').replace(/\//g, '\\'));
    return [trimmedBase.replace(/[\\]+$/, ''), ...cleanSegments].join('\\');
  }

  return path.join(trimmedBase, ...segments);
}

// Load .env and .env.local if present in current directory, config directory, or parent directory
const possibleEnvFiles = [
  process.env.ENV_FILE ? path.resolve(process.env.ENV_FILE) : '',
  path.resolve(process.cwd(), 'data', 'config', '.env.local'),
  path.resolve(process.cwd(), 'data', 'config', '.env'),
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '..', 'data', 'config', '.env.local'),
  path.resolve(process.cwd(), '..', 'data', 'config', '.env'),
  path.resolve(process.cwd(), '..', '.env.local'),
  path.resolve(process.cwd(), '..', '.env'),
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
  
  get port(): number {
    return parseInt(process.env.PORT || process.env.API_PORT || '8000', 10);
  }

  get catalogerApiUrl(): string {
    return process.env.CATALOGER_API_URL || 'http://localhost:8001';
  }

  get settingsFilePath(): string {
    if (process.env.CONFIG_PATH && process.env.CONFIG_PATH.trim()) {
      return path.resolve(process.env.CONFIG_PATH.trim(), 'settings.json');
    }
    if (process.env.SETTINGS_PATH && process.env.SETTINGS_PATH.trim()) {
      return path.resolve(process.env.SETTINGS_PATH.trim());
    }
    return path.resolve(this.projectRoot, 'data', 'config', 'settings.json');
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
      return savedInputs.map(p => normalizeConfigPath(String(p), this.projectRoot));
    }
    const envInputs = process.env.INPUT_FOLDERS || process.env.MEDIA_INPUT;
    if (envInputs && envInputs.trim()) {
      return envInputs.split(',').map(p => p.trim()).filter(Boolean).map(p => normalizeConfigPath(p, this.projectRoot));
    }
    return [normalizeConfigPath('media_input', this.projectRoot)];
  }

  get outputFolder(): string {
    const saved = this.getSavedSettings();
    const savedOutput = saved.OUTPUT_FOLDER || saved.output_folder;
    if (savedOutput && String(savedOutput).trim()) {
      return normalizeConfigPath(String(savedOutput).trim(), this.projectRoot);
    }
    const envOutput = process.env.OUTPUT_FOLDER || process.env.MEDIA_OUTPUT;
    if (envOutput && envOutput.trim()) {
      return normalizeConfigPath(envOutput.trim(), this.projectRoot);
    }
    return normalizeConfigPath('media_output', this.projectRoot);
  }

  get dbPath(): string {
    if (process.env.DB_PATH && process.env.DB_PATH.trim()) {
      const explicit = normalizeConfigPath(process.env.DB_PATH.trim(), this.projectRoot);
      if (fs.existsSync(explicit)) return explicit;
    }
    const saved = this.getSavedSettings();
    const savedOutput = saved.OUTPUT_FOLDER || saved.output_folder;
    if (savedOutput && String(savedOutput).trim()) {
      const out = normalizeConfigPath(String(savedOutput).trim(), this.projectRoot);
      const configDb = joinConfigPaths(out, 'config', 'catalog_history.db');
      if (fs.existsSync(configDb)) return configDb;
      const rootDb = joinConfigPaths(out, 'catalog_history.db');
      if (fs.existsSync(rootDb)) return rootDb;
    }
    if (process.env.OUTPUT_FOLDER && process.env.OUTPUT_FOLDER.trim()) {
      const out = normalizeConfigPath(process.env.OUTPUT_FOLDER.trim(), this.projectRoot);
      const configDb = joinConfigPaths(out, 'config', 'catalog_history.db');
      if (fs.existsSync(configDb)) return configDb;
      const rootDb = joinConfigPaths(out, 'catalog_history.db');
      if (fs.existsSync(rootDb)) return rootDb;
    }
    const fallbackConfigDb = joinConfigPaths(this.outputFolder, 'config', 'catalog_history.db');
    if (fs.existsSync(fallbackConfigDb)) return fallbackConfigDb;
    return joinConfigPaths(this.outputFolder, 'catalog_history.db');
  }

  get familyTreeDbPath(): string {
    if (process.env.FAMILY_TREE_DB_PATH && process.env.FAMILY_TREE_DB_PATH.trim()) {
      return normalizeConfigPath(process.env.FAMILY_TREE_DB_PATH.trim(), this.projectRoot);
    }
    const saved = this.getSavedSettings();
    const savedOutput = saved.OUTPUT_FOLDER || saved.output_folder;
    if (savedOutput && String(savedOutput).trim()) {
      const out = normalizeConfigPath(String(savedOutput).trim(), this.projectRoot);
      return joinConfigPaths(out, 'family_tree.db');
    }
    if (process.env.OUTPUT_FOLDER && process.env.OUTPUT_FOLDER.trim()) {
      const out = normalizeConfigPath(process.env.OUTPUT_FOLDER.trim(), this.projectRoot);
      return joinConfigPaths(out, 'family_tree.db');
    }
    return joinConfigPaths(this.outputFolder, 'family_tree.db');
  }

  get facesFolder(): string {
    if (process.env.FACES_FOLDER && process.env.FACES_FOLDER.trim()) {
      return normalizeConfigPath(process.env.FACES_FOLDER.trim(), this.projectRoot);
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
    return new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.raw', '.arw', '.cr2', '.nef', '.dng', '.tiff', '.bmp']);
  }

  get supportedVideoExts(): Set<string> {
    return new Set(['.mp4', '.mov', '.avi', '.mkv', '.wmv', '.m4v', '.webm', '.flv', '.3gp']);
  }
}
