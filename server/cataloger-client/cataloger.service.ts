import { Injectable, Logger, Inject, BadRequestException, Optional } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { AppConfigService } from '../config/config.service.js';
import { MediaService } from '../media/media.service.js';
import { LogBufferService, LogLevel } from '../logging/log-buffer.service.js';

@Injectable()
export class CatalogerClientService {
  private readonly logger = new Logger(CatalogerClientService.name);

  constructor(
    @Inject(AppConfigService) private readonly config: AppConfigService,
    @Inject(MediaService) private readonly mediaService: MediaService,
    @Inject(LogBufferService) @Optional() private readonly logBuffer?: LogBufferService,
  ) {}

  private get baseUrl(): string {
    return this.config.catalogerApiUrl.replace(/\/+$/, '');
  }

  async triggerRun(force: boolean = false, customPayload?: any): Promise<any> {
    const execConfig = this.config.getPipelineExecutionConfig();
    this.logBuffer?.info('Pipeline', `Initiating media catalog synchronization (force=${Boolean(force)})`);

    const scanned = this.mediaService.scanInputFolders();
    this.logBuffer?.debug('Pipeline', `Found ${scanned.length} media file(s) across input sources`, {
      inputFolders: execConfig.input_folders,
      totalFiles: scanned.length,
    });

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
      this.logBuffer?.debug('Pipeline', `Sending payload to cataloger service at ${this.baseUrl}/api/run`, {
        filesCount: files.length,
        outputFolder: execConfig.output_folder,
        modelProvider: execConfig.model_provider,
        geminiModel: execConfig.gemini_model,
      });

      const res = await axios.post(`${this.baseUrl}/api/run?force=${Boolean(force)}`, payload, {
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' },
      });

      this.logBuffer?.info('Pipeline', `Cataloger pipeline started successfully: ${res.data?.message || 'Processing in background'}`, res.data);

      return {
        ...res.data,
        provided_files_count: files.length,
      };
    } catch (err: any) {
      const detail = err.response?.data?.detail || err.response?.data?.error || err.message;
      const status = err.response?.status;
      const errorMsg = `Failed to trigger run on cataloger BE service (HTTP ${status || 'ERR'}): ${detail}`;
      this.logger.error(errorMsg);

      this.logBuffer?.error('Pipeline', errorMsg, {
        status: status || 502,
        endpoint: `POST ${this.baseUrl}/api/run`,
        cause: detail,
        suggestion: status === 502 || !status
          ? 'Check if the media_cataloger background daemon is running on port 8000.'
          : 'Verify execution settings and target folders.',
        stack: err.stack,
      });

      throw new Error(`Cataloger service error (${status || 'Network'}): ${detail}`);
    }
  }

  async triggerAnalyzeFile(file: string, customPayload?: any): Promise<any> {
    if (!file || !file.trim()) {
      this.logBuffer?.warn('Pipeline', 'Single file analysis requested with empty file path');
      throw new BadRequestException('File parameter cannot be empty');
    }

    const trimmed = file.trim();
    this.logBuffer?.info('Pipeline', `Initiating single file analysis for: ${trimmed}`);

    const accessCheck = this.mediaService.verifyFileAccess(trimmed);
    if (!accessCheck.accessible || !accessCheck.resolvedPath) {
      const accessErr = `Cannot analyze file: ${accessCheck.error}`;
      this.logger.warn(accessErr);
      this.logBuffer?.error('Pipeline', accessErr, {
        status: 400,
        cause: accessCheck.error,
        suggestion: 'Verify that the file path exists and is inside an approved input directory.',
      });
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
      this.logBuffer?.error('Pipeline', `Failed to read file stat: ${err.message}`, {
        file: resolvedPath,
        cause: err.message,
        stack: err.stack,
      });
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
      this.logBuffer?.debug('Pipeline', `Sending single-file analysis request to ${this.baseUrl}/api/analyze-file`, {
        file: resolvedPath,
        size,
      });

      const res = await axios.post(
        `${this.baseUrl}/api/analyze-file?file=${encodeURIComponent(resolvedPath)}`,
        payload,
        {
          timeout: 15000,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      this.logBuffer?.info('Pipeline', `Single file analysis successfully queued for '${path.basename(resolvedPath)}'`, res.data);
      return res.data;
    } catch (err: any) {
      const detail = err.response?.data?.detail || err.response?.data?.error || err.message;
      const status = err.response?.status;
      const errMsg = `Failed to trigger file analysis on BE (HTTP ${status || 'ERR'}): ${detail}`;
      this.logger.error(errMsg);

      this.logBuffer?.error('Pipeline', errMsg, {
        status: status || 502,
        endpoint: `POST ${this.baseUrl}/api/analyze-file`,
        targetFile: resolvedPath,
        cause: detail,
        suggestion: 'Verify cataloger daemon is running and file format is supported.',
        stack: err.stack,
      });

      throw new Error(`Cataloger service error (${status || 'Network'}): ${detail}`);
    }
  }

  async pause(): Promise<any> {
    this.logBuffer?.info('Pipeline', 'Pausing pipeline execution');
    try {
      const res = await axios.post(`${this.baseUrl}/api/pause`, {}, { timeout: 10000 });
      this.logBuffer?.info('Pipeline', 'Pipeline paused successfully');
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message;
      this.logBuffer?.error('Pipeline', `Failed to pause pipeline: ${msg}`, { cause: msg, stack: err.stack });
      throw new Error(`Cataloger service error: ${msg}`);
    }
  }

  async resume(): Promise<any> {
    this.logBuffer?.info('Pipeline', 'Resuming pipeline execution');
    try {
      const res = await axios.post(`${this.baseUrl}/api/resume`, {}, { timeout: 10000 });
      this.logBuffer?.info('Pipeline', 'Pipeline resumed successfully');
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message;
      this.logBuffer?.error('Pipeline', `Failed to resume pipeline: ${msg}`, { cause: msg, stack: err.stack });
      throw new Error(`Cataloger service error: ${msg}`);
    }
  }

  async stop(): Promise<any> {
    this.logBuffer?.info('Pipeline', 'Stopping pipeline execution');
    try {
      const res = await axios.post(`${this.baseUrl}/api/stop`, {}, { timeout: 10000 });
      this.logBuffer?.info('Pipeline', 'Pipeline stopped successfully');
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message;
      this.logBuffer?.error('Pipeline', `Failed to stop pipeline: ${msg}`, { cause: msg, stack: err.stack });
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

  async getLogs(level?: LogLevel | 'ALL'): Promise<{ logs: string; entries?: any[] }> {
    // If we have buffer entries in LogBufferService, combine with remote/file logs
    const bufferResult = this.logBuffer ? this.logBuffer.getLogs(level) : null;

    let remoteLogsText = '';
    // Try cataloger service endpoint first
    try {
      const res = await axios.get(`${this.baseUrl}/api/logs`, { timeout: 4000 });
      if (res.data && typeof res.data.logs === 'string') {
        remoteLogsText = res.data.logs;
      }
    } catch {
      // Fallback to local log file in media_output
      const logPath = path.join(this.config.outputFolder, 'cataloger_run.log');
      if (fs.existsSync(logPath)) {
        try {
          const content = fs.readFileSync(logPath, 'utf-8');
          const lines = content.split('\n');
          remoteLogsText = lines.slice(-300).join('\n');
        } catch {
          // ignore
        }
      }
    }

    if (bufferResult && bufferResult.entries.length > 0) {
      if (remoteLogsText && remoteLogsText.trim()) {
        // If remote logs has distinct content, merge
        return {
          logs: bufferResult.logs,
          entries: bufferResult.entries,
        };
      }
      return {
        logs: bufferResult.logs,
        entries: bufferResult.entries,
      };
    }

    if (remoteLogsText) {
      return { logs: remoteLogsText };
    }

    return { logs: 'No active cataloger logs found.' };
  }

  async clearLogs(): Promise<{ status: string; message: string }> {
    if (this.logBuffer) {
      this.logBuffer.clearLogs();
    }

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
