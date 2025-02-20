import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const cliDir = join(__dirname, '..', 'cli');

async function buildCli() {
  console.log('Building CLI...');

  return new Promise<void>((resolve, reject) => {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const buildProcess = spawn(npmCommand, ['run', 'build'], {
      cwd: cliDir,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      windowsVerbatimArguments: process.platform === 'win32',
    });

    buildProcess.on('error', (error) => {
      console.error('Failed to start build process:', error);
      reject(error);
    });

    buildProcess.on('close', (code) => {
      if (code === 0) {
        console.log('CLI build completed successfully.');
        resolve();
      } else {
        console.error(`CLI build failed with code ${code}`);
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });
}

buildCli().catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});
