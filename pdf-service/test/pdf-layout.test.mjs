import test from 'node:test';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import { renderPdfBuffer } from '../src/pdf-renderer.js';
import { renderOverviewReportHtml } from '../src/overview-report.js';
import {
  compactExecutiveSummaryFixture,
  completeOverviewReportFixture,
  stressExecutiveSummaryFixture,
  verboseExecutiveSummaryFixture
} from './report-fixtures.mjs';

test.after(async () => {
  await renderPdfBuffer.close();
});

test('a nine-project budget overview fits one landscape page without a trailing page', { timeout: 60000 }, async () => {
  const fixture = completeOverviewReportFixture();
  const baseProject = fixture.week.projects[0];
  fixture.week.projects = Array.from({ length: 9 }, (_, index) => ({
    ...baseProject,
    name: `Project ${index + 1}`,
    code: `P-${index + 1}`
  }));
  fixture.sections = ['budget-overview'];

  const pdf = await renderPdfBuffer(renderOverviewReportHtml(fixture));
  const pageObjects = Buffer.from(pdf).toString('latin1').match(/\/Type\s*\/Page\b/g) || [];

  assert.equal(pageObjects.length, 1);
});

test('compact Executive Summary renders exactly two landscape pages', { timeout: 60000 }, async () => {
  const fixture = completeOverviewReportFixture();
  fixture.sections = ['executive-summary'];
  fixture.week.executiveSummary = compactExecutiveSummaryFixture();

  const pdf = await renderPdfBuffer(renderOverviewReportHtml(fixture));
  const pageObjects = Buffer.from(pdf).toString('latin1').match(/\/Type\s*\/Page\b/g) || [];

  assert.equal(pageObjects.length, 2);
});

test('verbose Executive Summary renders only formal continuation pages', { timeout: 60000 }, async () => {
  const fixture = completeOverviewReportFixture();
  fixture.sections = ['executive-summary'];
  fixture.week.executiveSummary = verboseExecutiveSummaryFixture();

  const html = renderOverviewReportHtml(fixture);
  assert.equal((html.match(/class="report-page"/g) || []).length, 5);
  assert.equal((html.match(/class="report-page-head"/g) || []).length, 5);
  assert.equal((html.match(/class="report-footer"/g) || []).length, 5);
  const pdf = await renderPdfBuffer(html);
  const pageObjects = Buffer.from(pdf).toString('latin1').match(/\/Type\s*\/Page\b/g) || [];

  assert.equal(pageObjects.length, 5);
});

test('aligns every verbose Executive Summary wrapper to its own printable page', { timeout: 60000 }, async () => {
  const fixture = completeOverviewReportFixture();
  fixture.sections = ['executive-summary'];
  fixture.week.executiveSummary = verboseExecutiveSummaryFixture();
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  try {
    await page.setContent(renderOverviewReportHtml(fixture), { waitUntil: 'networkidle0' });
    const frames = await page.evaluate(() => [...document.querySelectorAll('.report-page')].map(node => {
      const pageRect = node.getBoundingClientRect();
      const headerRect = node.querySelector('.report-page-head').getBoundingClientRect();
      const footerRect = node.querySelector('.report-footer').getBoundingClientRect();
      return {
        top: pageRect.top,
        height: pageRect.height,
        headerTop: headerRect.top - pageRect.top,
        footerBottom: footerRect.bottom - pageRect.top
      };
    }));

    assert.equal(frames.length, 5);
    frames.forEach((frame, index) => {
      assert.ok(Math.abs(frame.top - index * frame.height) < 1, `page ${index + 1} must begin at a page boundary`);
      assert.ok(Math.abs(frame.height - 793.7) < 1, `page ${index + 1} must be A4 landscape height`);
      assert.ok(frame.headerTop > 20, `page ${index + 1} header must not be clipped`);
      assert.ok(frame.footerBottom < frame.height - 20, `page ${index + 1} footer must remain inside its page`);
    });
  } finally {
    await page.close();
    await browser.close();
  }
});

test('splits high-text Executive Summary cards before any wrapper exceeds A4 height', { timeout: 60000 }, async () => {
  const fixture = completeOverviewReportFixture();
  fixture.sections = ['executive-summary'];
  fixture.week.executiveSummary = stressExecutiveSummaryFixture();
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  try {
    await page.setContent(renderOverviewReportHtml(fixture), { waitUntil: 'networkidle0' });
    const heights = await page.evaluate(() => [...document.querySelectorAll('.report-page')]
      .map(node => node.getBoundingClientRect().height));

    assert.ok(heights.length > 5);
    heights.forEach((height, index) => {
      assert.ok(Math.abs(height - 793.7) < 1, `stress page ${index + 1} must remain A4 height`);
    });
    const pdf = await renderPdfBuffer(renderOverviewReportHtml(fixture));
    const pageObjects = Buffer.from(pdf).toString('latin1').match(/\/Type\s*\/Page\b/g) || [];
    assert.equal(pageObjects.length, heights.length);
  } finally {
    await page.close();
    await browser.close();
  }
});
