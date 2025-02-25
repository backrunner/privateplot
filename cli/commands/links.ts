import inquirer from 'inquirer';
import { logger } from '../utils/logger';
import type { Settings } from '../types';
import Table from 'cli-table3';
import chalk from 'chalk';
import { apiRequest } from '../utils/api';

interface FriendLink {
  id: string;
  name: string;
  url: string;
  description?: string;
  avatar?: string;
  status?: 'active' | 'inactive';
}

export async function addLink(settings: Settings) {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Enter friend link name:',
      validate: (input) => input.length > 0 || 'Name cannot be empty',
    },
    {
      type: 'input',
      name: 'url',
      message: 'Enter friend link URL:',
      validate: (input) => {
        try {
          new URL(input);
          return true;
        } catch {
          return 'Please enter a valid URL';
        }
      },
    },
    {
      type: 'input',
      name: 'description',
      message: 'Enter friend link description (optional):',
    },
    {
      type: 'input',
      name: 'avatar',
      message: 'Enter avatar URL (optional):',
      validate: (input) => {
        if (!input) return true;
        try {
          new URL(input);
          return true;
        } catch {
          return 'Please enter a valid URL';
        }
      },
    },
    {
      type: 'list',
      name: 'status',
      message: 'Select status:',
      choices: [
        { name: 'Active', value: 'active' },
        { name: 'Inactive', value: 'inactive' },
      ],
      default: 'active',
    },
  ]);

  try {
    const result = await apiRequest(settings, {
      method: 'POST',
      path: '/api/internal/friend-links',
      body: answers
    });

    if (!result.success) {
      throw new Error(`Failed to add: ${result.error}`);
    }

    logger.success('Friend link added successfully!');
  } catch (error) {
    logger.error(`Error adding friend link: ${error}`);
  }
}

export async function modifyLink(settings: Settings) {
  try {
    const linksResult = await apiRequest<FriendLink[]>(settings, {
      path: '/api/internal/friend-links'
    });

    if (!linksResult.success) {
      throw new Error('Failed to get friend links list');
    }

    const links = linksResult.data || [];
    if (links.length === 0) {
      logger.info('No friend links found');
      return;
    }

    const { linkId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'linkId',
        message: 'Select friend link to modify:',
        choices: links.map((link: FriendLink) => ({
          name: `${link.name} (${link.url})`,
          value: link.id,
        })),
      },
    ]);

    const currentLink = links.find((link: FriendLink) => link.id === linkId);
    if (!currentLink) {
      throw new Error('Selected friend link not found');
    }

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Enter new name (leave empty to keep current):',
        default: currentLink.name,
      },
      {
        type: 'input',
        name: 'url',
        message: 'Enter new URL (leave empty to keep current):',
        default: currentLink.url,
        validate: (input) => {
          try {
            new URL(input);
            return true;
          } catch {
            return 'Please enter a valid URL';
          }
        },
      },
      {
        type: 'input',
        name: 'description',
        message: 'Enter new description (leave empty to keep current):',
        default: currentLink.description,
      },
      {
        type: 'input',
        name: 'avatar',
        message: 'Enter new avatar URL (leave empty to keep current):',
        default: currentLink.avatar,
        validate: (input) => {
          if (!input) return true;
          try {
            new URL(input);
            return true;
          } catch {
            return 'Please enter a valid URL';
          }
        },
      },
      {
        type: 'list',
        name: 'status',
        message: 'Select new status:',
        choices: [
          { name: 'Active', value: 'active' },
          { name: 'Inactive', value: 'inactive' },
        ],
        default: currentLink.status,
      },
    ]);

    const updateData = Object.fromEntries(
      Object.entries(answers).filter(([_, value]) => value !== '')
    );

    const updateResult = await apiRequest(settings, {
      method: 'PUT',
      path: `/api/internal/friend-links/${linkId}`,
      body: updateData
    });

    if (!updateResult.success) {
      throw new Error(`Failed to modify: ${updateResult.error}`);
    }

    logger.success('Friend link modified successfully!');
  } catch (error) {
    logger.error(`Error modifying friend link: ${error}`);
  }
}

export async function deleteLink(settings: Settings) {
  try {
    const linksResult = await apiRequest<FriendLink[]>(settings, {
      path: '/api/internal/friend-links'
    });

    if (!linksResult.success) {
      throw new Error('Failed to get friend links list');
    }

    const links = linksResult.data || [];
    if (links.length === 0) {
      logger.info('No friend links found');
      return;
    }

    const { linkId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'linkId',
        message: 'Select friend link to delete:',
        choices: links.map((link: FriendLink) => ({
          name: `${link.name} (${link.url})`,
          value: link.id,
        })),
      },
    ]);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Are you sure you want to delete this friend link? This action cannot be undone',
        default: false,
      },
    ]);

    if (!confirm) {
      logger.info('Operation cancelled');
      return;
    }

    const deleteResult = await apiRequest(settings, {
      method: 'DELETE',
      path: `/api/internal/friend-links/${linkId}`
    });

    if (!deleteResult.success) {
      throw new Error(`Failed to delete: ${deleteResult.error}`);
    }

    logger.success('Friend link deleted successfully!');
  } catch (error) {
    logger.error(`Error deleting friend link: ${error}`);
  }
}

export async function listLinks(settings: Settings) {
  try {
    const linksResult = await apiRequest<FriendLink[]>(settings, {
      path: '/api/internal/friend-links'
    });

    if (!linksResult.success) {
      throw new Error('Failed to get friend links list');
    }

    const links = linksResult.data || [];
    if (links.length === 0) {
      logger.info('No friend links found');
      return;
    }

    const table = new Table({
      head: ['Name', 'URL', 'Description', 'Status'],
      style: {
        head: ['cyan'],
        border: ['gray'],
      },
      wordWrap: true,
      wrapOnWordBoundary: true,
    });

    links.forEach((link) => {
      table.push([
        link.name,
        link.url,
        link.description || '-',
        link.status === 'active'
          ? chalk.green('Active')
          : chalk.yellow('Inactive'),
      ]);
    });

    console.log(table.toString());
    logger.info(`Total: ${links.length} links`);
  } catch (error) {
    logger.error(`Error listing friend links: ${error}`);
  }
}
