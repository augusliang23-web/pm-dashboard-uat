export const REPORT_CSS = `
  @page { size: A4 landscape; margin:0; }
  :root {
    --ink:#26384a;
    --muted:#718196;
    --line:#d7dee7;
    --surface:#f5f8fb;
    --green:#57967f;
    --green-soft:#e8f3ee;
    --yellow:#c99732;
    --yellow-soft:#fff5dc;
    --red:#b85c5c;
    --red-soft:#fdecec;
    --blue:#5b7fa3;
    --white:#fff;
  }
  * { box-sizing:border-box; }
  html,body { margin:0; padding:0; background:var(--white); }
  body {
    color:var(--ink);
    font:9.5pt Arial,"Noto Sans CJK TC",sans-serif;
    -webkit-print-color-adjust:exact;
    print-color-adjust:exact;
  }
  h1,h2,h3,p { margin-top:0; }
  h1 { margin-bottom:1mm; font-size:20pt; line-height:1.1; }
  h2 { margin-bottom:3mm; font-size:13pt; line-height:1.2; }
  h3 { margin-bottom:2mm; font-size:10pt; line-height:1.25; }
  .report-document { width:100%; }
  .report-page {
    width:297mm;
    min-height:210mm;
    padding:11mm 12mm 9mm;
    break-after:page;
    display:flex;
    flex-direction:column;
  }
  .report-page:last-child { break-after:auto; }
  .report-page-head {
    display:flex;
    justify-content:space-between;
    align-items:flex-start;
    gap:8mm;
    padding-bottom:4mm;
    border-bottom:1px solid var(--line);
  }
  .report-kicker {
    margin-bottom:1.5mm;
    color:var(--green);
    font-size:7.5pt;
    font-weight:700;
    letter-spacing:.12em;
    text-transform:uppercase;
  }
  .report-title { margin:0; }
  .report-meta { color:var(--muted); font-size:8pt; white-space:nowrap; }
  .report-body { flex:1; min-height:0; padding-top:5mm; }
  .report-footer {
    display:flex;
    justify-content:space-between;
    gap:8mm;
    padding-top:3mm;
    color:var(--muted);
    font-size:7.5pt;
  }
  .card {
    border:1px solid var(--line);
    border-radius:4mm;
    background:var(--white);
    padding:4mm;
    break-inside:avoid;
  }
  .card-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:4mm; }
  .metric-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:3mm; }
  .metric-card-label { color:var(--muted); font-size:7.5pt; font-weight:700; text-transform:uppercase; }
  .metric-card-value { margin-top:1.5mm; font-size:18pt; font-weight:800; line-height:1; }
  .metric-card-detail { margin-top:1.5mm; color:var(--muted); font-size:8pt; }
  .metric-card.yellow { background:var(--yellow-soft); }
  .metric-card.red { background:var(--red-soft); }
  .metric-card.green { background:var(--green-soft); }
  .status-badge {
    display:inline-flex;
    align-items:center;
    border-radius:99px;
    padding:1.2mm 2.4mm;
    font-size:8pt;
    font-weight:700;
  }
  .status-badge.green { color:var(--green); background:var(--green-soft); }
  .status-badge.yellow { color:#8a641c; background:var(--yellow-soft); }
  .status-badge.red { color:var(--red); background:var(--red-soft); }
  .status-badge.neutral { color:var(--muted); background:var(--surface); }
  .progress-track { height:3mm; border-radius:99px; overflow:hidden; background:#e6ecf2; }
  .progress-fill { height:100%; background:var(--green); }
  .progress-fill.yellow { background:var(--yellow); }
  .progress-fill.red { background:var(--red); }
  table { width:100%; border-collapse:collapse; }
  thead { display:table-header-group; }
  tr,.keep-together { break-inside:avoid; }
  th,td { padding:2.4mm; border-bottom:1px solid var(--line); vertical-align:top; }
  th {
    color:var(--muted);
    font-size:7.5pt;
    letter-spacing:.04em;
    text-align:left;
    text-transform:uppercase;
  }
  .empty-state {
    border:1px dashed var(--line);
    border-radius:3mm;
    padding:6mm;
    color:var(--muted);
    text-align:center;
  }
  .project-brief-grid { display:grid; grid-template-columns:1.25fr .75fr 1.1fr; gap:4mm; margin-bottom:4mm; }
  .project-identity-card h2 { margin-bottom:1.5mm; font-size:17pt; }
  .project-code { margin-bottom:3mm; color:var(--muted); text-transform:capitalize; }
  .project-progress-card { display:flex; flex-direction:column; justify-content:center; }
  .project-progress-value { margin:2mm 0 3mm; font-size:27pt; font-weight:800; }
  .project-context-card { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:3mm; margin:0; }
  .project-context-card div { min-width:0; }
  .project-context-card dt { color:var(--muted); font-size:7.5pt; font-weight:700; text-transform:uppercase; }
  .project-context-card dd { margin:1mm 0 0; font-weight:700; overflow-wrap:anywhere; }
  .project-update-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:4mm; }
  .project-update-card { min-height:62mm; }
  .project-update-card.risk { border-color:#e5b5b5; background:linear-gradient(180deg,var(--red-soft),var(--white) 38%); }
  .report-list { margin:0; padding-left:5mm; }
  .report-list li { margin-bottom:2.2mm; line-height:1.35; }
  .milestone-timeline { position:relative; display:grid; grid-template-columns:repeat(var(--count),minmax(0,1fr)); gap:7mm; padding:17mm 4mm 0; }
  .milestone-timeline::before { content:""; position:absolute; top:10mm; left:7%; right:7%; height:1px; background:var(--line); }
  .milestone-step { position:relative; min-width:0; padding:5mm 4mm; border:1px solid var(--line); border-radius:4mm; background:var(--white); text-align:center; }
  .milestone-dot { position:absolute; top:-13mm; left:50%; width:5mm; height:5mm; border:1.2mm solid var(--white); border-radius:50%; background:var(--muted); box-shadow:0 0 0 1px var(--line); transform:translateX(-50%); }
  .milestone-dot.green { background:var(--green); } .milestone-dot.yellow { background:var(--yellow); } .milestone-dot.red { background:var(--red); }
  .milestone-step time { display:block; margin:2mm 0; color:var(--muted); }
  .milestone-list { list-style:none; margin:0; padding:0; }
  .milestone-row { display:grid; grid-template-columns:34mm minmax(0,1fr) 28mm; align-items:center; gap:5mm; padding:4mm; border-bottom:1px solid var(--line); }
  .milestone-row time { color:var(--muted); }
  .gantt-grid { display:grid; gap:2.5mm; }
  .gantt-axis { display:flex; justify-content:space-between; margin-left:53mm; padding:0 32mm 1mm 0; color:var(--muted); font-size:7.5pt; }
  .gantt-row { display:grid; grid-template-columns:48mm minmax(0,1fr) 28mm; align-items:center; gap:5mm; min-height:13mm; }
  .gantt-label { min-width:0; }
  .gantt-label strong,.gantt-label small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .gantt-label small { margin-top:1mm; color:var(--muted); font-size:7pt; }
  .gantt-track { position:relative; height:8mm; border-radius:2mm; background:repeating-linear-gradient(90deg,#f0f4f7 0,#f0f4f7 calc(10% - 1px),#dfe7ee calc(10% - 1px),#dfe7ee 10%); }
  .gantt-track.unscheduled { display:flex; align-items:center; justify-content:center; background:var(--surface); }
  .gantt-bar { position:absolute; top:1mm; height:6mm; min-width:4mm; overflow:hidden; border-radius:1.5mm; background:#dfe5ea; }
  .gantt-completed { display:block; height:100%; background:var(--green); opacity:.9; }
  .gantt-bar.yellow .gantt-completed { background:var(--yellow); } .gantt-bar.red .gantt-completed { background:var(--red); }
  .gantt-bar b { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:6.5pt; color:var(--ink); }
  .gantt-state { text-align:right; }
  .project-resource-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:5mm; align-items:start; }
  .project-resource-grid.single { grid-template-columns:1fr; }
  .resource-card { min-width:0; }
  .budget-metrics { margin-bottom:5mm; }
  .budget-comparison { padding:6mm; }
  .budget-bar-row { display:grid; grid-template-columns:22mm minmax(0,1fr) 36mm; align-items:center; gap:4mm; margin:4mm 0; }
  .budget-bar-row strong { text-align:right; }
  .budget-track { height:6mm; overflow:hidden; border-radius:99px; background:#e6ecf2; }
  .budget-track i { display:block; height:100%; background:var(--blue); }
  .budget-track i.actual { background:var(--green); } .budget-track i.red { background:var(--red); }
`;
