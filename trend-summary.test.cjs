const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(`${__dirname}/index.html`, 'utf8');
const match = html.match(/\/\* trend-axis:start \*\/([\s\S]*?)\/\* trend-axis:end \*\//);
assert.ok(match, 'shared trend axis helper is missing');

const context = {};
vm.runInNewContext(`${match[1]}; this.trendXCoordinates = trendXCoordinates;`, context);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.trendXCoordinates(4, 360, 12))),
  [12, 124, 236, 348]
);
assert.ok(html.includes('weekly-trend-axis-label'), 'trend labels must render inside the SVG');
assert.ok(!html.includes('<div class="weekly-trend-labels">'), 'detached trend labels must be removed');
assert.ok(html.includes('function getTrendWeeks(limit = 12)'), 'trend history should include up to 12 weeks');
assert.ok(html.includes('const width = 720;'), 'trend SVG should use the wider coordinate system');
assert.ok(html.includes('Portfolio Summary:'), 'AI prompt must require an explicit portfolio summary');
assert.ok(html.includes('exec-summary-portfolio-lead'), 'portfolio lead needs dedicated rendering');
const promptHelper = html.match(/function addPortfolioSummaryInstruction\(prompt\) \{([\s\S]*?)\n\}/);
assert.ok(promptHelper, 'portfolio summary prompt helper is missing');
const promptContext = {};
vm.runInNewContext(`${promptHelper[0]}; this.addPortfolioSummaryInstruction = addPortfolioSummaryInstruction;`, promptContext);
const legacyPrompt = [
  '- Under each section, use one bullet per project in this exact pattern: - Exact Project Name: concise update.',
  '- Use the exact official project name from the supplied data before the colon. Do not add labels such as Delays, Recovery, Escalation, or Kickoff to the project name.',
  '- Keep every project in a separate bullet and insert one blank line between project bullets so the text remains readable when pasted into email.',
  '- Each project bullet may contain 1 to 3 concise sentences covering the meaningful movement, business impact, and next step when relevant.',
  '- Never combine multiple projects into one bullet. Use a separate Portfolio: bullet only for a genuinely portfolio-wide point.',
  '- WEEKLY MOVEMENT should normally contain 4 to 6 project bullets focused on progress changes, newly completed milestones, delayed milestones, new/continued/resolved risks, and attention changes.',
  '- MANAGEMENT ASK should contain 2 to 4 project bullets and only decisions, escalations, or unblock actions needed from management.',
  '- If no management action is needed, write exactly: - No immediate management decision required this week.'
].join('\n');
const revisedPrompt = promptContext.addPortfolioSummaryInstruction(legacyPrompt);
assert.ok(revisedPrompt.includes('Immediately below WEEKLY MOVEMENT write: Portfolio Summary:'));
assert.ok(revisedPrompt.includes('Movement: <one or two concise sentences>'));
assert.ok(!revisedPrompt.includes('Use a separate Portfolio: bullet'));

console.log('trend and summary tests passed');
