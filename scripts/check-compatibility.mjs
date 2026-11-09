import { cp, mkdir, mkdtemp, open, readFile, readdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const combinations = {
  '0.2.0-rc.1': { cordis: '4.0.4', schema: '3.18.4' },
  '0.2.0-rc.2': { cordis: '4.0.4', schema: '3.18.4' },
  '0.2.1-alpha.1': { cordis: '4.0.5-alpha.1', schema: '3.18.5-alpha.1' },
  '0.2.1-alpha.2': { cordis: '4.0.5-alpha.1', schema: '3.18.5-alpha.1' },
  '0.2.1-alpha.3': { cordis: '4.0.5-alpha.2', schema: '3.18.5-alpha.2' },
  '0.2.1-alpha.4': { cordis: '4.0.5-alpha.2', schema: '3.18.5-alpha.2' },
  '0.2.1-alpha.5': { cordis: '4.0.5-alpha.2', schema: '3.18.5-alpha.2' },
  '0.2.1-rc.1': { cordis: '4.0.5', schema: '3.18.5' },
  '0.2.1-rc.2': { cordis: '4.0.5', schema: '3.18.5' },
  '0.2.1-rc.3': { cordis: '4.0.5', schema: '3.18.5' },
  '0.2.1-rc.4': { cordis: '4.0.5', schema: '3.18.5' },
  '0.2.1-rc.5': { cordis: '4.0.5', schema: '3.18.5' },
  '0.2.2-alpha.2': { cordis: '4.0.6-alpha.1', schema: '3.18.6-alpha.1' },
};
const versions = process.argv.length > 2 ? process.argv.slice(2) : Object.keys(combinations).filter(version => /^0\.2\.[01]-/.test(version));
for (const version of versions) {
  if (!Object.hasOwn(combinations, version)) throw new Error(`Unsupported test target: ${version}`);
}
const output = path.join(root, '.references', 'compatibility-tests');
await mkdir(output, { recursive: true });
const summary = [];

async function run(directory, name, command, args, environment = {}) {
  const log = path.join(directory, `${name}.log`);
  const handle = await open(log, 'wx');
  let code;
  try {
    const env = { ...process.env, ...environment };
    if (!Object.hasOwn(environment, 'POWER_DSH_HOST_TEST_ENTRY')) delete env.POWER_DSH_HOST_TEST_ENTRY;
    const child = spawn(command, args, { cwd: directory, env, stdio: ['ignore', handle.fd, handle.fd] });
    [code] = await once(child, 'close');
  } finally { await handle.close(); }
  if (code !== 0) throw new Error(`${name} exited with ${code}; inspect ${log}`);
}

const npmCommand = process.env.npm_execpath ? process.execPath : 'npm';
const npmArgs = args => process.env.npm_execpath ? [process.env.npm_execpath, ...args] : args;
for (const version of versions) {
  const directory = await mkdtemp(path.join(output, `${version}-`));
  const result = { version, directory, ...combinations[version], passed: false };
  summary.push(result);
  console.log(`Testing DSH SDK ${version}; isolated files: ${directory}`);
  try {
    for (const entry of await readdir(root, { withFileTypes: true })) {
      const includeFile = entry.isFile() && [
        'package.json', 'pnpm-lock.yaml', '.gitignore', 'README.md', 'AGENTS.md', 'CHANGELOG.md', 'cordis.patch.yml', 'screenshots.json',
      ].includes(entry.name);
      const includeDirectory = entry.isDirectory() && ['src', 'assets', 'scripts', 'tests', 'docs'].includes(entry.name);
      if (includeFile || includeDirectory) {
        await cp(path.join(root, entry.name), path.join(directory, entry.name), { recursive: true, force: false, errorOnExist: true });
      }
    }
    const manifestPath = path.join(directory, 'package.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.dependencies = {
      '@deepseek-ai/cordis': combinations[version].cordis,
      '@deepseek-ai/schemastery': combinations[version].schema,
      '@deepseek-ai/dsh-tools': version,
      '@deepseek-ai/dsh-typert-protocol': version,
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await run(directory, 'install', npmCommand, npmArgs(['install', '--ignore-scripts', '--no-audit', '--no-fund', '--registry=https://registry.npmjs.org']));
    await run(directory, 'check', npmCommand, npmArgs(['run', 'check']));
    // Keep production imports unchanged while resolving the test's Context and
    // real Tools/Projection services from the historical SDK installation.
    await run(directory, 'production-sdk-host', process.execPath, ['--test', 'tests/host-wiring.test.mjs'], {
      POWER_DSH_HOST_TEST_ENTRY: pathToFileURL(path.join(root, 'src/index.js')).href,
    });
    result.passed = true;
    console.log(`${version}: repository checks and production-SDK Host wiring passed.`);
  } catch (error) {
    result.error = error.message;
    process.exitCode = 1;
    console.error(`${version}: ${error.message}`);
  }
}
const report = path.join(output, `summary-${Date.now()}.json`);
await writeFile(report, `${JSON.stringify(summary, null, 2)}\n`, { flag: 'wx' });
console.log(`Compatibility evidence: ${report}`);
console.log('This runner does not install a DSH application or modify a user profile. Full artifact and GUI acceptance remain separate.');
