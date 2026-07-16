import test from 'node:test';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import { paginateMeasuredFlows } from '../src/measured-paginator.js';
import { renderOverviewReportHtml } from '../src/overview-report.js';
import { completeOverviewReportFixture, legacyExecutiveSummaryFixture } from './report-fixtures.mjs';

async function browserPage(html) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  return { page, browser };
}

async function measuredPages(page) {
  return page.evaluate(() => [...document.querySelectorAll('[data-measured-page="executive-summary"]')].map(pageNode => ({
    blocks: pageNode.querySelectorAll('[data-pdf-flow-item]').length,
    bodyBottom: pageNode.querySelector('[data-pdf-flow-items]').getBoundingClientRect().bottom,
    footerTop: pageNode.querySelector('.report-footer').getBoundingClientRect().top,
    title: pageNode.querySelector('.report-title').textContent.trim(),
    height: pageNode.getBoundingClientRect().height
  })));
}

test('fills remaining page space before creating a continuation page', { timeout: 60000 }, async () => {
  const fixture = completeOverviewReportFixture();
  fixture.sections = ['executive-summary'];
  fixture.week.executiveSummary = legacyExecutiveSummaryFixture();
  const { page, browser } = await browserPage(renderOverviewReportHtml(fixture));

  try {
    assert.equal(await page.$$eval('.report-page', nodes => nodes.length), 1);
    const summary = await page.evaluate(paginateMeasuredFlows);
    const pages = await measuredPages(page);

    assert.equal(summary.flows, 1);
    assert.equal(summary.pages, pages.length);
    assert.ok(pages.length < 23);
    assert.ok(pages.some(result => result.blocks >= 3));
    pages.forEach((result, index) => {
      assert.ok(result.bodyBottom <= result.footerTop - 29, `page ${index + 1} must keep an 8 mm footer gap`);
      assert.ok(Math.abs(result.height - 793.7) < 1, `page ${index + 1} must remain A4 landscape height`);
    });
  } finally {
    await page.close();
    await browser.close();
  }
});

test('keeps every generated page in source order and marks continuations', { timeout: 60000 }, async () => {
  const fixture = completeOverviewReportFixture();
  fixture.sections = ['executive-summary'];
  fixture.week.executiveSummary = legacyExecutiveSummaryFixture();
  const { page, browser } = await browserPage(renderOverviewReportHtml(fixture));

  try {
    await page.evaluate(paginateMeasuredFlows);
    const kinds = await page.$$eval('[data-pdf-flow-item]', nodes => nodes.map(node => node.dataset.flowKind));
    const pages = await measuredPages(page);

    assert.deepEqual(kinds, [
      'portfolio-summary',
      'priority-project', 'priority-project',
      'management-decision', 'management-decision', 'management-decision', 'management-decision',
      'project-context', 'project-context', 'project-context', 'project-context', 'project-context', 'project-context'
    ]);
    assert.ok(pages.slice(1).some(result => /Continued$/.test(result.title)));
  } finally {
    await page.close();
    await browser.close();
  }
});

function oversizedSummaryFixture() {
  const long = label => `${label} ${'measured pagination content '.repeat(180)}`;
  return `WEEKLY MOVEMENT
Portfolio Summary: Oversized-card verification.
- Project: Oversized Project
  Movement: ${long('MOVEMENT-MARKER')}
  Blocker: ${long('BLOCKER-MARKER')}
  Next step: ${long('NEXT-STEP-MARKER')}
MANAGEMENT ASK
- Project: Oversized Project
  Decision / Support needed: ${long('DECISION-MARKER')}
  Business impact: ${long('IMPACT-MARKER')}`;
}

function oversizedFieldSummaryFixture() {
  return `WEEKLY MOVEMENT
Portfolio Summary: Oversized-field verification.
- Project: One Field Project
  Movement: FIELD-START ${'single field continuation text '.repeat(500)} FIELD-END
  Blocker: None
  Next step: Confirm completion.
MANAGEMENT ASK`;
}

test('splits an oversized card between labelled fields without losing text', { timeout: 60000 }, async () => {
  const fixture = completeOverviewReportFixture();
  fixture.sections = ['executive-summary'];
  fixture.week.executiveSummary = oversizedSummaryFixture();
  const { page, browser } = await browserPage(renderOverviewReportHtml(fixture));

  try {
    await page.evaluate(paginateMeasuredFlows);
    const text = await page.$eval('.report-document', node => node.textContent.replace(/\s+/g, ' ').trim());
    ['MOVEMENT-MARKER', 'BLOCKER-MARKER', 'NEXT-STEP-MARKER', 'DECISION-MARKER', 'IMPACT-MARKER']
      .forEach(token => assert.match(text, new RegExp(token)));
    const pages = await measuredPages(page);
    assert.ok(pages.length > 1);
    pages.forEach((result, index) => {
      assert.ok(result.bodyBottom <= result.footerTop - 29, `oversized page ${index + 1} must fit`);
    });
  } finally {
    await page.close();
    await browser.close();
  }
});

test('splits one oversized field at a word boundary', { timeout: 60000 }, async () => {
  const fixture = completeOverviewReportFixture();
  fixture.sections = ['executive-summary'];
  fixture.week.executiveSummary = oversizedFieldSummaryFixture();
  const { page, browser } = await browserPage(renderOverviewReportHtml(fixture));

  try {
    await page.evaluate(paginateMeasuredFlows);
    assert.ok(await page.$$eval('[data-pdf-field]', nodes => nodes.length > 1));
    const text = await page.$eval('body', node => node.textContent);
    assert.match(text, /Movement · Continued/);
    assert.match(text, /FIELD-START/);
    assert.match(text, /FIELD-END/);
  } finally {
    await page.close();
    await browser.close();
  }
});
