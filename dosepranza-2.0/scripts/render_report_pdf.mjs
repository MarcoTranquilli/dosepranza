import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const reportPath = path.resolve(__dirname, '..', 'playwright-report', 'index.html');
const pdfPath = path.resolve(__dirname, '..', 'playwright-report', 'uat-report.pdf');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file://${reportPath}`, { waitUntil: 'networkidle' });
await page.pdf({
  path: pdfPath,
  format: 'A4',
  printBackground: true,
  margin: { top: '16mm', right: '12mm', bottom: '16mm', left: '12mm' }
});
await browser.close();

console.log(`UAT PDF report created: ${pdfPath}`);
