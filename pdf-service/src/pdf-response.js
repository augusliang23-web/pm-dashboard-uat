export const MAX_PDF_BYTES = 8 * 1024 * 1024;

export class PdfOutputError extends Error {
  constructor(message = 'Generated PDF exceeds the 8 MiB download limit. Select fewer sections and try again.') {
    super(message);
    this.name = 'PdfOutputError';
    this.statusCode = 413;
  }
}

function assertSafeFilename(filename) {
  if (typeof filename !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*\.pdf$/.test(filename)) {
    throw new TypeError('A safe PDF filename is required.');
  }
}

export function sendPdfDownload(response, pdfBuffer, filename) {
  if (!(pdfBuffer instanceof Uint8Array)) {
    throw new TypeError('PDF output must be a Buffer or Uint8Array.');
  }
  const output = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
  assertSafeFilename(filename);
  if (output.byteLength > MAX_PDF_BYTES) {
    throw new PdfOutputError();
  }
  response.statusCode = 200;
  response.setHeader('Content-Type', 'application/pdf');
  response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  response.setHeader('Cache-Control', 'no-store, private');
  response.setHeader('Content-Length', String(output.length));
  response.end(output);
}
