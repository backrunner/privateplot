import { mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';

const KATEX_CSS_SOURCE = path.join(process.cwd(), 'node_modules', 'katex', 'dist', 'katex.min.css');
const PUBLIC_CSS_DIR = path.join(process.cwd(), 'public', 'css');
const KATEX_CSS_DEST = path.join(PUBLIC_CSS_DIR, 'katex.min.css');

async function main() {
  try {
    // Ensure the public/css directory exists
    await mkdir(PUBLIC_CSS_DIR, { recursive: true });

    // Copy KaTeX CSS from node_modules
    console.log('Copying KaTeX CSS...');
    await copyFile(KATEX_CSS_SOURCE, KATEX_CSS_DEST);
    console.log('KaTeX CSS copied successfully!');
  } catch (error) {
    console.error('Error building assets:', error);
    process.exit(1);
  }
}

main().catch(console.error);
