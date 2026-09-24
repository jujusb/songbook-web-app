import puppeteer from 'puppeteer';

const SESSION_COOKIE = 'songbook-session';

const COMMON_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
];

/**
 * Render the URL with headless Chromium and return the resulting PDF buffer.
 * `sessionCookie` (optional) is the caller's `songbook-session` cookie value,
 * forwarded to the local page so it can resolve editor-only setlists even
 * though the headless browser carries no browser cookies of its own.
 */
export async function generatePdfFromUrl(
  url: string,
  sessionCookie?: string | null,
): Promise<ArrayBuffer> {
  const browser = await puppeteer.launch({ args: COMMON_ARGS });
  try {
    const page = await browser.newPage();
    if (sessionCookie) {
      await page.setCookie({
        name: SESSION_COOKIE,
        value: sessionCookie,
        domain: '127.0.0.1',
        path: '/',
      });
    }
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });
    // Copy into a dedicated ArrayBuffer so the body is a plain ArrayBuffer
    // (PDF bytes from the browser are not guaranteed to be backed by one).
    const bytes = new Uint8Array(pdf.byteLength);
    bytes.set(pdf);
    return bytes.buffer as ArrayBuffer;
  } finally {
    await browser.close();
  }
}

/**
 * Extract the `songbook-session` cookie value from a raw `Cookie` header.
 */
export function extractSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return rest.join('=');
  }
  return null;
}

/**
 * Turn an arbitrary title into a safe, ASCII-only PDF filename (sans extension).
 */
export function safePdfFilename(title: string): string {
  const cleaned = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return cleaned || 'setlist';
}