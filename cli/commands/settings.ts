import { dump } from 'js-yaml';
import { writeFile } from 'node:fs/promises';
import { CONFIG_FILE, loadSettings } from '../utils/config';
import { logger } from '../utils/logger';

interface SettingsOptions {
  host?: string;
  token?: string;
}

export async function handleSettings(options: SettingsOptions) {
  try {
    const settings = await loadSettings();
    let updated = false;

    if (options.host) {
      settings.instanceHost = options.host;
      updated = true;
    }

    if (options.token) {
      settings.internalAuthToken = options.token;
      updated = true;
    }

    if (updated) {
      await writeFile(CONFIG_FILE, dump(settings));
      logger.success('Settings updated successfully');
    } else {
      logger.settingsHeader();
      logger.settings('Instance Host', settings.instanceHost || 'Not set');
      logger.settings('Auth Token', settings.internalAuthToken ? '********' : 'Not set');
      logger.settingsFooter();
    }
  } catch (error) {
    logger.error(`Error updating settings: ${error}`);
    process.exit(1);
  }
} 