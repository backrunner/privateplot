import dotenv from 'dotenv';
import { load } from 'js-yaml';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { Settings } from '../types';
import { logger } from './logger';

dotenv.config();

const CONFIG_PATHS = [
  join(process.cwd(), '.privateplot'),      // JSON
  join(process.cwd(), '.privateplot.json'), // JSON
  join(process.cwd(), '.privateplot.yaml'), // YAML
  join(process.cwd(), '.privateplot.yml'),  // YAML
] as const;

const DEFAULT_HOST = 'http://localhost:4321';

export async function loadSettings(): Promise<Settings> {
  const configFile = CONFIG_PATHS.find(path => existsSync(path));

  if (!configFile) {
    const instanceHost = process.env.PRIVATEPLOT_HOST || DEFAULT_HOST;
    if (!process.env.PRIVATEPLOT_HOST) {
      logger.warning('No instance host configured, using default: ' + DEFAULT_HOST);
    }
    return { instanceHost };
  }

  try {
    const content = await readFile(configFile, 'utf-8');
    let fileSettings: Settings;

    if (configFile.endsWith('.json')) {
      fileSettings = JSON.parse(content);
    } else {
      fileSettings = load(content) as Settings;
    }

    const instanceHost = process.env.PRIVATEPLOT_HOST || fileSettings.instanceHost || DEFAULT_HOST;
    if (!process.env.PRIVATEPLOT_HOST && !fileSettings.instanceHost) {
      logger.warning('No instance host configured, using default: ' + DEFAULT_HOST);
    }

    return {
      ...fileSettings,
      instanceHost,
    };
  } catch {
    const instanceHost = process.env.PRIVATEPLOT_HOST || DEFAULT_HOST;
    if (!process.env.PRIVATEPLOT_HOST) {
      logger.warning('No instance host configured, using default: ' + DEFAULT_HOST);
    }
    return { instanceHost };
  }
}

export const CONFIG_FILE = CONFIG_PATHS[0];

export async function getAuthToken(settings: Settings): Promise<string> {
  return process.env.INTERNAL_AUTH_TOKEN || settings.internalAuthToken || '';
}
