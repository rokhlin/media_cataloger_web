import { Injectable, Logger, Inject, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { AppConfigService } from '../config/config.service.js';
import { MediaService } from '../media/media.service.js';

@Injectable()
export class CatalogerClientService {
  private readonly logger = new Logger(CatalogerClientService.name);

  constructor(
    @Inject(AppConfigService) private readonly config: AppConfigService,
    @Inject(MediaService) private readonly mediaService: MediaService,
  ) {}

  private get baseUrl(): string {
    return this.config.catalogerApiUrl.replace(/\/+$/, '');
  }

  async triggerRun(force: boolean = false, customPayload?: any): Promise<any> {
    const execConfig = this.config.getPipelineExecutionConfig();
    const scanned = this.mediaService.scanInputFolders();

    const files = scanned.map(s => {
      let size = 0;
      let mtime = 0;
      try {
        const stat = fs.statSync(s.filePath);
        size = stat.size;
        mtime = stat.mtimeMs / 1000;
      } catch {
        // file stat error
      }
      return {
        file_path: s.filePath,
        folder: s.folder,
        filename: path.basename(s.filePath),
        file_size: size,
        mtime: mtime,
        stream_url: `${execConfig.ui_base_url}/api/media/file?path=${encodeURIComponent(s.filePath)}`,
      };
    });

    const payload = {
      force: Boolean(force),
      total_files: files.length,
      files: files,
      output_folder: execConfig.output_folder,
      settings: execConfig,
      ...(customPayload || {}),
    };

    try {
      this.logger.log(`Triggering BE run: ${files.length} file(s) across input sources -> ${execConfig.output_folder}`);
      const res = await axios.post(`${this.baseUrl}/api/run?force=${Boolean(force)}`, payload, {
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' },
      });
      return {
        ...res.data,
        provided_files_count: files.length,
      };
    } catch (err: any) {
      const detail = err.response?.data?.detail || err.response?.data?.error || err.message;
      const status = err.response?.status;
      this.logger.error(`Failed to trigger run on cataloger BE service (HTTP ${status || 'ERR'}): ${detail}`);
      throw new Error(`Cataloger service error (${status || 'Network'}): ${detail}`);
    }
  }

  async triggerAnalyzeFile(file: string, customPayload?: any): Promise<any> {
    if (!file || !file.trim()) {
      throw new BadRequestException('File parameter cannot be empty');
    }

    const trimmed = file.trim();
    const accessCheck = this.mediaService.verifyFileAccess(trimmed);
    if (!accessCheck.accessible || !accessCheck.resolvedPath) {
      this.logger.warn(`Cannot analyze file: ${accessCheck.error}`);
      throw new BadRequestException(`File access error: ${accessCheck.error}`);
    }

    const resolvedPath = accessCheck.resolvedPath;
    let size = 0;
    let mtime = 0;
    try {
      const stat = fs.statSync(resolvedPath);
      size = stat.size;
      mtime = stat.mtimeMs / 1000;
    } catch (err: any) {
      throw new BadRequestException(`Unable to read file stat for '${resolvedPath}': ${err.message}`);
    }

    const execConfig = this.config.getPipelineExecutionConfig();
    const payload = {
      file: resolvedPath,
      filename: path.basename(resolvedPath),
      folder: path.dirname(resolvedPath),
      file_size: size,
      mtime: mtime,
      output_folder: execConfig.output_folder,
      settings: execConfig,
      stream_url: `${execConfig.ui_base_url}/api/media/file?path=${encodeURIComponent(resolvedPath)}`,
      ...(customPayload || {}),
    };

    try {
      this.logger.log(`Triggering single file analysis on BE: ${resolvedPath}`);
      const res = await axios.post(
        `${this.baseUrl}/api/analyze-file?file=${encodeURIComponent(resolvedPath)}`,
        payload,
        {
          timeout: 15000,
          headers: { 'Content-Type': 'application/json' },
        }
      );
      return res.data;
    } catch (err: any) {
      const detail = err.response?.data?.detail || err.response?.data?.error || err.message;
      const status = err.response?.status;
      this.logger.error(`Failed to trigger file analysis on BE (HTTP ${status || 'ERR'}): ${detail}`);
      throw new Error(`Cataloger service error (${status || 'Network'}): ${detail}`);
    }
  }

  async pause(): Promise<any> {
    try {
      const res = await axios.post(`${this.baseUrl}/api/pause`, {}, { timeout: 10000 });
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message;
      throw new Error(`Cataloger service error: ${msg}`);
    }
  }

  async resume(): Promise<any> {
    try {
      const res = await axios.post(`${this.baseUrl}/api/resume`, {}, { timeout: 10000 });
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message;
      throw new Error(`Cataloger service error: ${msg}`);
    }
  }

  async stop(): Promise<any> {
    try {
      const res = await axios.post(`${this.baseUrl}/api/stop`, {}, { timeout: 10000 });
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message;
      throw new Error(`Cataloger service error: ${msg}`);
    }
  }

  async validateConnection(): Promise<{
    connected: boolean;
    cataloger_url: string;
    message: string;
    details?: any;
    latency_ms?: number;
  }> {
    const startTime = Date.now();
    try {
      const res = await axios.get(`${this.baseUrl}/api/status`, { timeout: 4000 });
      const latencyMs = Date.now() - startTime;
      return {
        connected: true,
        cataloger_url: this.baseUrl,
        message: `Successfully connected to media_cataloger service (${latencyMs}ms)`,
        details: res.data,
        latency_ms: latencyMs,
      };
    } catch (err: any) {
      return {
        connected: false,
        cataloger_url: this.baseUrl,
        message: `Unable to reach media_cataloger service at ${this.baseUrl}: ${err.message}`,
      };
    }
  }

  async getStatus(): Promise<any> {
    try {
      const res = await axios.get(`${this.baseUrl}/api/status`, { timeout: 4000 });
      return {
        ...res.data,
        connected: true,
        cataloger_url: this.baseUrl,
      };
    } catch (err: any) {
      // Return idle fallback if cataloger service is offline or starting
      return {
        status: 'idle',
        connected: false,
        cataloger_url: this.baseUrl,
        current_task: null,
        started_at: null,
        finished_at: null,
        error: null,
        target_file: null,
        progress: {
          current: 0,
          total: 0,
          percent: 0,
          current_file: '',
          stage: 'Cataloger service offline or idle',
        },
      };
    }
  }

  async getLogs(): Promise<{ logs: string }> {
    // Try cataloger service endpoint first
    try {
      const res = await axios.get(`${this.baseUrl}/api/logs`, { timeout: 4000 });
      if (res.data && typeof res.data.logs === 'string') {
        return res.data;
      }
    } catch {
      // Fallback to local log file in media_output
    }

    const logPath = path.join(this.config.outputFolder, 'cataloger_run.log');
    if (fs.existsSync(logPath)) {
      try {
        const content = fs.readFileSync(logPath, 'utf-8');
        const lines = content.split('\n');
        const lastLines = lines.slice(-200).join('\n');
        return { logs: lastLines };
      } catch (err) {
        return { logs: `Error reading local log file: ${err}` };
      }
    }

    return { logs: 'No active cataloger logs found.' };
  }

  async clearLogs(): Promise<{ status: string; message: string }> {
    try {
      const res = await axios.post(`${this.baseUrl}/api/logs/clear`, {}, { timeout: 4000 });
      if (res.data) {
        return res.data;
      }
    } catch {
      // Fallback to local log file in media_output
    }

    const logPath = path.join(this.config.outputFolder, 'cataloger_run.log');
    if (fs.existsSync(logPath)) {
      try {
        fs.writeFileSync(logPath, '', 'utf-8');
        return { status: 'success', message: 'Local logs cleared' };
      } catch (err) {
        return { status: 'error', message: `Error clearing local log file: ${err}` };
      }
    }

    return { status: 'success', message: 'Logs cleared' };
  }
}

