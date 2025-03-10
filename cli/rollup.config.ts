import { babel } from '@rollup/plugin-babel';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import * as fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
const external = Object.keys(pkg.dependencies || {}).concat(['fs/promises']);

const extensions = ['.js', '.ts'];

export default {
  input: 'index.ts',
  output: {
    file: './bin/cli.js',
    format: 'esm',
    banner: '#!/usr/bin/env node',
  },
  external,
  plugins: [
    nodeResolve({
      extensions,
      modulesOnly: true,
    }),
    json(),
    babel({
      exclude: ['node_modules/**', './history/**'],
      babelHelpers: 'bundled',
      extensions,
    }),
  ],
};
