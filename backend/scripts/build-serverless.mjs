import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');
const esmTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cidash-esm-'));
const outFile = path.join(backendDir, 'dist', 'serverless.mjs');

fs.mkdirSync(path.dirname(outFile), { recursive: true });

const tscBin = path.resolve(backendDir, '..', 'node_modules', 'typescript', 'bin', 'tsc');
const localTscBin = path.resolve(backendDir, 'node_modules', 'typescript', 'bin', 'tsc');
const resolvedTsc = fs.existsSync(localTscBin) ? localTscBin : tscBin;

try {
  execFileSync(
    process.execPath,
    [
      resolvedTsc,
      '-p',
      path.join(backendDir, 'tsconfig.build.json'),
      '--module',
      'ESNext',
      '--moduleResolution',
      'bundler',
      '--outDir',
      esmTmpDir,
      '--incremental',
      'false',
      '--declaration',
      'false',
      '--sourceMap',
      'false',
    ],
    { cwd: backendDir, stdio: 'inherit' },
  );

  const bundle = await rolldown({
    input: path.join(esmTmpDir, 'main.js'),
    platform: 'node',
    external: (id) =>
      !id.startsWith('.') && !id.startsWith('/') && !path.isAbsolute(id),
  });

  await bundle.write({
    file: outFile,
    format: 'esm',
    sourcemap: false,
  });

  await bundle.close();
} finally {
  fs.rmSync(esmTmpDir, { recursive: true, force: true });
}

console.log(`Built Vercel ESM serverless bundle: ${path.relative(backendDir, outFile)}`);
