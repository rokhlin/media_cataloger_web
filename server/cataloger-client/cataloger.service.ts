import { Injectable, Logger, Inject } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { AppConfigService } from '../config/config.service.js';

@Injectable()
export class CatalogerClientService {
  private readonly logger = new Logger(CatalogerClientService.name);

  constructor(@Inject(AppConfigService) private readonly config: AppConfigService) {}

  private get baseUrl(): string {
    return this.config.catalogerApiUrl.replace(/\/+$/, '');
  }

  async triggerRun(force: boolean = false): Promise<any> {
    try {
      const res = await axios.post(`${this.baseUrl}/api/run?force=${Boolean(force)}`, {}, { timeout: 10000 });
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message;
      this.logger.error(`Failed to trigger run on cataloger service: ${msg}`);
      throw new Error(`Cataloger service error: ${msg}`);
    }
  }

  async triggerAnalyzeFile(file: string): Promise<any> {
    try {
      const res = await axios.post(
        `${this.baseUrl}/api/analyze-file?file=${encodeURIComponent(file)}`,
        {},
        { timeout: 10000 }
      );
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message;
      this.logger.error(`Failed to trigger file analysis: ${msg}`);
      throw new Error(`Cataloger service error: ${msg}`);
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

  async getStatus(): Promise<any> {
    try {
      const res = await axios.get(`${this.baseUrl}/api/status`, { timeout: 4000 });
      return res.data;
    } catch (err: any) {
      // Return idle fallback if cataloger service is offline or starting
      return {
        status: 'idle',
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

