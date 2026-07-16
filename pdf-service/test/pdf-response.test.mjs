import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_PDF_BYTES,
  PdfOutputError,
  sendPdfDownload
} from '../src/pdf-response.js';

function createResponse() {
  return {
    headers: new Map(),
    statusCode: 0,
    body: undefined,
    setHeader(name, value) { this.headers.set(name, value); },
    end(body) { this.body = body; }
  };
}

test('sends an in-memory PDF as an attachment download', () => {
  const response = createResponse();
  const pdf = Buffer.from('%PDF-test');

  sendPdfDownload(response, pdf, 'PMS-W28.pdf');

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers.get('Content-Type'), 'application/pdf');
  assert.equal(response.headers.get('Content-Disposition'), 'attachment; filename="PMS-W28.pdf"');
  assert.equal(response.headers.get('Cache-Control'), 'no-store, private');
  assert.equal(response.headers.get('Content-Length'), String(pdf.length));
  assert.equal(response.body, pdf);
});

test('sends Puppeteer Uint8Array PDF output as an attachment download', () => {
  const response = createResponse();
  const pdf = new Uint8Array(Buffer.from('%PDF-puppeteer'));

  sendPdfDownload(response, pdf, 'overview-W28.pdf');

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers.get('Content-Length'), String(pdf.byteLength));
  assert.ok(Buffer.isBuffer(response.body));
  assert.deepEqual(response.body, Buffer.from(pdf));
});

test('rejects non-buffer output and unsafe filenames', () => {
  const response = createResponse();
  assert.throws(() => sendPdfDownload(response, 'pdf', 'report.pdf'), /Buffer/);
  assert.throws(() => sendPdfDownload(response, Buffer.from('pdf'), '../report.pdf'), /safe PDF filename/);
});

test('rejects PDF output above 8 MiB before setting download headers', () => {
  const response = createResponse();

  assert.throws(
    () => sendPdfDownload(response, new Uint8Array(MAX_PDF_BYTES + 1), 'large.pdf'),
    PdfOutputError
  );
  assert.equal(response.statusCode, 0);
  assert.equal(response.headers.size, 0);
  assert.equal(response.body, undefined);
});
