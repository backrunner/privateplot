import { load } from 'js-yaml';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import type { Settings } from '../types';

const CONFIG_PATHS = [
  join(homedir(), '.privateplot'),      // JSON
  join(homedir(), '.privateplot.json'), // JSON
  join(homedir(), '.privateplot.yaml'), // YAML
  join(homedir(), '.privateplot.yml'),  // YAML
] as const;

export async function loadSettings(): Promise<Settings> {
  // 查找第一个存在的配置文件
  const configFile = CONFIG_PATHS.find(path => existsSync(path));

  if (!configFile) {
    return {
      instanceHost: process.env.PRIVATEPLOT_HOST,
    };
  }

  try {
    const content = await readFile(configFile, 'utf-8');
    let fileSettings: Settings;

    // 根据文件扩展名决定解析方式
    if (configFile.endsWith('.json')) {
      fileSettings = JSON.parse(content);
    } else {
      fileSettings = load(content) as Settings;
    }

    return {
      ...fileSettings,
      instanceHost: process.env.PRIVATEPLOT_HOST || fileSettings.instanceHost,
    };
  } catch {
    return {
      instanceHost: process.env.PRIVATEPLOT_HOST,
    };
  }
}

// 使用第一个配置文件路径作为默认的写入路径
export const CONFIG_FILE = CONFIG_PATHS[0];

export async function getAuthToken(settings: Settings): Promise<string> {
  return process.env.INTERNAL_AUTH_TOKEN || settings.internalAuthToken || '';
} 