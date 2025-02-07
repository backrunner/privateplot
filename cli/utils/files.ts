import { readdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

export async function isMarkdownFile(filePath: string): Promise<boolean> {
  try {
    const stats = await stat(filePath);
    return stats.isFile() && extname(filePath).toLowerCase() === '.md';
  } catch {
    return false;
  }
}

export async function isDirectory(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

export async function findMarkdownFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  
  async function scan(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const path = join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // 跳过 node_modules 和 .git 等目录
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await scan(path);
        }
      } else if (entry.isFile() && extname(entry.name).toLowerCase() === '.md') {
        files.push(path);
      }
    }
  }
  
  await scan(directory);
  return files;
}

export async function hasFileChanged(filePath: string, lastPublished: string | undefined): Promise<boolean> {
  if (!lastPublished) return true;
  
  try {
    const { mtime } = await stat(filePath);
    const lastPublishedDate = new Date(lastPublished);
    return mtime > lastPublishedDate;
  } catch {
    return true;
  }
} 