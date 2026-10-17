import { cp, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const backendUrl = process.env.BACKEND_URL;
if (!backendUrl) {
  throw new Error('Set BACKEND_URL to the Render backend origin before building the Vercel frontend.');
}

const parsedBackendUrl = new URL(backendUrl);
if (parsedBackendUrl.protocol !== 'https:') {
  throw new Error('BACKEND_URL must use HTTPS.');
}

const sourceDirectory = resolve('library-management-system/src/main/resources/static');
const outputDirectory = resolve('dist');

await mkdir(outputDirectory, { recursive: true });
await cp(sourceDirectory, outputDirectory, { recursive: true });
await writeFile(
  resolve(outputDirectory, 'config.js'),
  `window.LIBRISPHERE_API_BASE = ${JSON.stringify(`${parsedBackendUrl.origin}/api`)};\n`
);