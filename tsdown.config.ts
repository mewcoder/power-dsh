import { defineConfig, type UserConfig } from 'tsdown';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('.', import.meta.url));
const common = {
  cwd,
  outDir: 'dist',
  clean: false,
  sourcemap: false,
  minify: false,
  hash: false,
  exports: false,
  report: false,
  tsconfig: 'tsconfig.json',
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
} satisfies UserConfig;

export const hostConfig = {
  ...common,
  name: 'host',
  entry: { index: 'src/index.ts' },
  format: 'esm',
  platform: 'node',
  target: 'node22',
  dts: true,
  deps: { neverBundle: [/^@deepseek-ai\//] },
  outputOptions: { entryFileNames: '[name].js' },
} satisfies UserConfig;

export const clientConfig = {
  ...common,
  name: 'client',
  entry: { client: 'src/client.ts' },
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  dts: false,
  outputOptions: { entryFileNames: '[name].js' },
} satisfies UserConfig;

export default defineConfig([hostConfig, clientConfig]);
