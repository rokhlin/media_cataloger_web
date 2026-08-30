import { Injectable, Logger, Inject } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { AppConfigService, normalizeConfigPath } from '../config/config.service.js';
import { DatabaseService } from '../database/database.service.js';

const execAsync = promisify(exec);

export interface DirectoryBrowseResult {
  current_path: string;
  parent_path: string | null;
  shortcuts: Array<{ label: string; path: string }>;
  directories: string[];
  files: string[];
  error?: string;
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @Inject(AppConfigService) private readonly config: AppConfigService,
    @Inject(DatabaseService) private readonly db: DatabaseService,
  ) { }

  getSettings() {
    const saved = this.config.getSavedSettings();
    const envInputs = (process.env.INPUT_FOLDERS || '')
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);
    const defaultInputs = envInputs.length > 0
      ? envInputs.map(p => normalizeConfigPath(p, this.config.projectRoot, { isDev: this.config.isDev, fallbackType: 'input' }))
      : [this.config.isDev ? normalizeConfigPath('media_input', this.config.projectRoot, { isDev: true }) : '/app/media_input'];
    const defaultOutput = process.env.OUTPUT_FOLDER 
      ? normalizeConfigPath(process.env.OUTPUT_FOLDER, this.config.projectRoot, { isDev: this.config.isDev, fallbackType: 'output' })
      : (this.config.isDev ? normalizeConfigPath('media_output', this.config.projectRoot, { isDev: true }) : '/app/media_output');

    return {
      input_folders: this.config.inputFolders.map(p => String(p)),
      output_folder: String(this.config.outputFolder),
      default_input_folders: defaultInputs.map(p => String(p)),
      default_output_folder: String(defaultOutput),
      is_custom_input: Boolean(saved.INPUT_FOLDERS || saved.input_folders),
      is_custom_output: Boolean(saved.OUTPUT_FOLDER || saved.output_folder),
      is_dev: this.config.isDev,
      model_provider: saved.MODEL_PROVIDER || process.env.MODEL_PROVIDER || 'gemini',
      gemini_model: saved.GEMINI_MODEL || process.env.GEMINI_MODEL || 'gemini-3.6-flash',
      local_model_name: saved.LOCAL_MODEL_NAME || process.env.LOCAL_MODEL_NAME || '',
      gemini_max_workers: saved.GEMINI_MAX_WORKERS ? Number(saved.GEMINI_MAX_WORKERS) : Number(process.env.GEMINI_MAX_WORKERS || 3),
      local_max_workers: saved.LOCAL_MAX_WORKERS ? Number(saved.LOCAL_MAX_WORKERS) : Number(process.env.LOCAL_MAX_WORKERS || 2),
      whisper_model: saved.WHISPER_MODEL || process.env.WHISPER_MODEL || 'large-v3-turbo',
      preserve_structure: saved.PRESERVE_STRUCTURE !== undefined ? Boolean(saved.PRESERVE_STRUCTURE) : true,
    };
  }

  updateSettings(dto: Partial<import('./dto/settings.dto.js').SettingsUpdateRequestDto>) {
    const cleanedInputs: string[] = [];
    if (dto.input_folders) {
      for (const inp of dto.input_folders) {
        if (inp.includes(',')) {
          cleanedInputs.push(...inp.split(',').map(p => p.trim()).filter(Boolean));
        } else if (inp.trim()) {
          cleanedInputs.push(inp.trim());
        }
      }
    }

    const cleanedOutput = dto.output_folder ? dto.output_folder.trim() : undefined;
    const additional: Record<string, any> = {};
    if (dto.model_provider !== undefined) additional.MODEL_PROVIDER = dto.model_provider;
    if (dto.gemini_model !== undefined) additional.GEMINI_MODEL = dto.gemini_model;
    if (dto.local_model_name !== undefined) additional.LOCAL_MODEL_NAME = dto.local_model_name;
    if (dto.gemini_max_workers !== undefined) additional.GEMINI_MAX_WORKERS = Number(dto.gemini_max_workers);
    if (dto.local_max_workers !== undefined) additional.LOCAL_MAX_WORKERS = Number(dto.local_max_workers);
    if (dto.whisper_model !== undefined) additional.WHISPER_MODEL = dto.whisper_model;
    if (dto.preserve_structure !== undefined) additional.PRESERVE_STRUCTURE = Boolean(dto.preserve_structure);

    this.config.saveSettings(
      cleanedInputs.length > 0 ? cleanedInputs : undefined,
      cleanedOutput,
      additional
    );

    // Re-initialize database with new path
    this.db.initDb();

    return {
      status: 'success',
      message: 'Settings updated successfully.',
      ...this.getSettings(),
    };
  }

  getShortcuts(): Array<{ label: string; path: string }> {
    const shortcuts: Array<{ label: string; path: string }> = [];

    // Project root shortcut
    shortcuts.push({ label: 'Project Root', path: this.config.projectRoot });

    if (this.config.isDev && os.platform() === 'win32') {
      const drives = ['C:\\', 'D:\\', 'E:\\', 'F:\\', 'Z:\\'];
      for (const drive of drives) {
        try {
          if (fs.existsSync(drive)) {
            shortcuts.push({ label: drive, path: drive });
          }
        } catch {
          // ignore
        }
      }
    } else {
      const candidates = ['/app/media_input', '/app/media_output', '/app/data/config', '/shares', '/media', '/mnt', '/data', '/app', '/home', '/'];
      for (const cand of candidates) {
        try {
          if (fs.existsSync(cand)) {
            shortcuts.push({ label: cand, path: cand });
          }
        } catch {
          // ignore
        }
      }
    }

    return shortcuts;
  }

  browseDirectory(targetPath?: string, mode: 'folder' | 'file' = 'folder'): DirectoryBrowseResult {
    const shortcuts = this.getShortcuts();
    let current = targetPath ? targetPath.trim() : '';

    if (!current) {
      current = this.config.projectRoot;
    }

    // In non-dev builds (e.g. Docker container), map Windows UNC or drive paths to container volume mount points
    if (!this.config.isDev && current) {
      const isUnc = current.startsWith('\\') || current.startsWith('//');
      const isWinDrive = /^[a-zA-Z]:[/\\]/.test(current);
      if (isUnc || isWinDrive) {
        const lower = current.toLowerCase();
        current = (lower.includes('output') || lower.includes('cataloger') || lower.includes('sda1'))
          ? '/app/media_output'
          : '/app/media_input';
      }
    }

    // Windows UNC path or drive letter handling
    const isUnc = current.startsWith('\\') || current.startsWith('//');
    const isWinDrive = /^[a-zA-Z]:[/\\]/.test(current);

    if (!isUnc && !isWinDrive && !path.isAbsolute(current)) {
      current = path.resolve(this.config.projectRoot, current);
    }

    try {
      if (!fs.existsSync(current)) {
        return {
          current_path: current,
          parent_path: this.getParentPath(current),
          shortcuts,
          directories: [],
          files: [],
          error: `Path does not exist: ${current}`,
        };
      }

      const stat = fs.statSync(current);
      if (!stat.isDirectory()) {
        current = path.dirname(current);
      }

      const entries = fs.readdirSync(current, { withFileTypes: true });
      const directories: string[] = [];
      const files: string[] = [];

      for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.env') continue;
        if (entry.name === 'node_modules' || entry.name === '__pycache__') continue;

        if (entry.isDirectory()) {
          directories.push(entry.name);
        } else if (mode === 'file' && entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (this.config.supportedPhotoExts.has(ext) || this.config.supportedVideoExts.has(ext) || ext === '.json' || ext === '.db') {
            files.push(entry.name);
          }
        }
      }

      directories.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      files.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

      return {
        current_path: current,
        parent_path: this.getParentPath(current),
        shortcuts,
        directories,
        files,
      };
    } catch (err: any) {
      this.logger.warn(`Failed to browse directory ${current}: ${err.message}`);
      return {
        current_path: current,
        parent_path: this.getParentPath(current),
        shortcuts,
        directories: [],
        files: [],
        error: err.message || 'Cannot access directory',
      };
    }
  }

  private getParentPath(current: string): string | null {
    if (!current) return null;
    if (current === '/' || /^[a-zA-Z]:[/\\]?$/.test(current)) {
      return null;
    }
    const parent = path.dirname(current);
    return parent === current ? null : parent;
  }

  async selectFolder(): Promise<{ folder: string }> {
    if (os.platform() === 'win32') {
      try {
        const psCommand = `powershell -NoProfile -Command "& { Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = 'Select Catalog Folder'; if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.SelectedPath } }"`;
        const { stdout } = await execAsync(psCommand);
        const folder = stdout.trim();
        return { folder: folder || '' };
      } catch (err) {
        this.logger.warn(`Folder picker failed: ${err}`);
      }
    }
    return { folder: '' };
  }

  async selectFile(): Promise<{ file: string }> {
    if (os.platform() === 'win32') {
      try {
        const psCommand = `powershell -NoProfile -Command "& { Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.OpenFileDialog; $f.Title = 'Select Media File'; $f.Filter = 'Media files (*.jpg;*.jpeg;*.png;*.webp;*.heic;*.mp4;*.mov;*.avi;*.mkv)|*.jpg;*.jpeg;*.png;*.webp;*.heic;*.mp4;*.mov;*.avi;*.mkv|All files (*.*)|*.*'; if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.FileName } }"`;
        const { stdout } = await execAsync(psCommand);
        const file = stdout.trim();
        return { file: file || '' };
      } catch (err) {
        this.logger.warn(`File picker failed: ${err}`);
      }
    }
    return { file: '' };
  }
}
