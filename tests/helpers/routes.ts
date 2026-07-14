import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const rawBaseUrl = process.env.BASE_URL || 'http://127.0.0.1:8081';
const parsedBaseUrl = new URL(rawBaseUrl);
const origin = `${parsedBaseUrl.protocol}//${parsedBaseUrl.host}`;
const e2e = parsedBaseUrl.searchParams.get('e2e');

export const previewHubUrl = `${origin}/`;
export const previewRussoUrl = `${origin}/russo/`;
export const previewPagnottellaUrl = `${origin}/pagnottella/?store=pagnottella`;
export const legacyRussoAppUrl = `${origin}/russo/${e2e ? `?e2e=${encodeURIComponent(e2e)}` : ''}`;

const localPreviewPath = resolve(process.cwd(), 'pagnottella', 'index.html');
export const previewPagnottellaFileUrl = `${pathToFileURL(localPreviewPath).href}?store=pagnottella`;
const localRussoPath = resolve(process.cwd(), 'russo', 'index.html');
export const previewRussoFileUrl = pathToFileURL(localRussoPath).href;
