import PptxGenJS from 'pptxgenjs';

const prs = new PptxGenJS();
prs.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 inches

// ── Dark Theme Colours ────────────────────────────────────────────────────
const BG        = '080C16';   // slide background
const SURFACE   = '0F1629';   // card/panel background
const SURFACE2  = '131D35';   // slightly lighter surface
const BORDER    = '1E2D4A';   // subtle border
const INDIGO    = '6366F1';
const PURPLE    = 'A855F7';
const CYAN      = '22D3EE';
const SKY       = '38BDF8';
const GREEN     = '22C55E';
const ORANGE    = 'F97316';
const PINK      = 'F472B6';
const YELLOW    = 'FBBF24';
const WHITE     = 'FFFFFF';
const SILVER    = 'CBD5E1';
const GRAY      = '64748B';
const DIM       = '334155';

// Accent gradient pairs  [primary, secondary]
const ACCENTS = [
  [INDIGO,  PURPLE ],
  [CYAN,    SKY    ],
  [GREEN,   CYAN   ],
  [ORANGE,  YELLOW ],
  [PURPLE,  PINK   ],
  [SKY,     INDIGO ],
];

function bg(s) {
  s.background = { color: BG };
}

function card(s, x, y, w, h, borderColor) {
  s.addShape(prs.ShapeType.roundRect, {
    x, y, w, h,
    fill: { color: SURFACE },
    line: { color: borderColor || BORDER, width: 0.8 },
    rectRadius: 0.12,
  });
}

function glowDot(s, x, y, color) {
  s.addShape(prs.ShapeType.ellipse, {
    x, y, w: 0.38, h: 0.38,
    fill: { color },
    line: { color, width: 0 },
    shadow: { type: 'outer', color, blur: 10, offset: 0, angle: 0, opacity: 0.7 },
  });
}

function tag(s, text, x, y, color) {
  s.addShape(prs.ShapeType.roundRect, {
    x, y, w: text.length * 0.095 + 0.3, h: 0.3,
    fill: { color, transparency: 82 },
    line: { color, width: 0.6 },
    rectRadius: 0.06,
  });
  s.addText(text, {
    x, y, w: text.length * 0.095 + 0.3, h: 0.3,
    fontSize: 8, bold: true, color, align: 'center', valign: 'middle', fontFace: 'Calibri',
  });
}

function numCircle(s, n, x, y, color) {
  s.addShape(prs.ShapeType.ellipse, { x, y, w: 0.48, h: 0.48, fill: { color }, line: { color, width: 0 } });
  s.addText(String(n), { x, y, w: 0.48, h: 0.48, fontSize: 13, bold: true, color: WHITE, align: 'center', valign: 'middle', fontFace: 'Calibri' });
}

// Decorative orb (faint glow circle)
function orb(s, x, y, size, color, opacity) {
  s.addShape(prs.ShapeType.ellipse, {
    x, y, w: size, h: size,
    fill: { color, transparency: Math.round((1 - opacity) * 100) },
    line: { color, width: 0 },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 1 — Title
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = prs.addSlide();
  bg(s);

  // Background orbs
  orb(s, -1, -1, 6, INDIGO, 0.04);
  orb(s, 8,  4,  5, PURPLE, 0.03);
  orb(s, 5,  -2, 4, CYAN,   0.025);

  // Animated border glow box for logo
  s.addShape(prs.ShapeType.roundRect, {
    x: 0.5, y: 1.8, w: 1.55, h: 1.55,
    fill: { color: SURFACE },
    line: { color: INDIGO, width: 1.2 },
    rectRadius: 0.22,
    shadow: { type: 'outer', color: INDIGO, blur: 14, offset: 0, angle: 0, opacity: 0.5 },
  });
  s.addText('⚡', { x: 0.5, y: 1.8, w: 1.55, h: 1.55, fontSize: 36, align: 'center', valign: 'middle' });

  // InfraStudio wordmark
  s.addText('InfraStudio', {
    x: 0.45, y: 3.55, w: 3.5, h: 0.75,
    fontSize: 28, bold: true, color: WHITE, fontFace: 'Calibri',
  });
  s.addText('Design. Compare. Deploy.', {
    x: 0.45, y: 4.3, w: 3.5, h: 0.4,
    fontSize: 11, color: GRAY, fontFace: 'Calibri', charSpacing: 1.5,
  });

  // Vertical separator
  s.addShape(prs.ShapeType.line, {
    x: 2.45, y: 1.5, w: 0, h: 4.6,
    line: { color: BORDER, width: 0.8 },
  });

  // Main headline
  s.addText('Cloud Infrastructure\nCommand Centre', {
    x: 2.75, y: 1.2, w: 10.2, h: 2.5,
    fontSize: 52, bold: true, color: WHITE, fontFace: 'Calibri', lineSpacingMultiple: 1.1,
  });

  // Gradient underline bar
  s.addShape(prs.ShapeType.rect, {
    x: 2.75, y: 3.75, w: 6, h: 0.06,
    fill: { type: 'grad', stops: [{ position: 0, color: INDIGO }, { position: 50, color: PURPLE }, { position: 100, color: CYAN }] },
    line: { color: INDIGO, width: 0 },
  });

  s.addText('Design, compare, and deploy cloud infrastructure from one unified platform', {
    x: 2.75, y: 3.95, w: 10.0, h: 0.55,
    fontSize: 14, italic: true, color: GRAY, fontFace: 'Calibri',
  });

  // Team info
  s.addShape(prs.ShapeType.line, { x: 2.75, y: 4.72, w: 6, h: 0, line: { color: BORDER, width: 0.5 } });
  s.addText([
    { text: 'Rohit Darekar  ', options: { bold: true, color: SILVER } },
    { text: '|  AIT Global Inc     ', options: { color: GRAY } },
    { text: 'Amol Funde  ', options: { bold: true, color: SILVER } },
    { text: '|  AIT Global Inc', options: { color: GRAY } },
  ], { x: 2.75, y: 4.85, w: 10.0, h: 0.38, fontSize: 12, fontFace: 'Calibri' });
  s.addText([
    { text: 'Vijay Kadam  ', options: { bold: true, color: SILVER } },
    { text: '|  AIT Global Inc', options: { color: GRAY } },
  ], { x: 2.75, y: 5.25, w: 10.0, h: 0.36, fontSize: 12, fontFace: 'Calibri' });
  s.addText([
    { text: 'Team Name:  ', options: { color: GRAY } },
    { text: 'The Orchestrators', options: { bold: true, color: INDIGO } },
  ], { x: 2.75, y: 5.65, w: 10.0, h: 0.36, fontSize: 12, fontFace: 'Calibri' });

  // Bottom accent dots
  [INDIGO, PURPLE, CYAN, SKY, GREEN].forEach((c, i) => {
    glowDot(s, 0.5 + i * 0.55, 6.85, c);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 2 — Presentation Roadmap
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = prs.addSlide();
  bg(s);
  orb(s, 9, -1, 5, INDIGO, 0.04);

  s.addText('Presentation Roadmap', {
    x: 0.45, y: 0.2, w: 12, h: 0.7, fontSize: 34, bold: true, color: WHITE, fontFace: 'Calibri',
  });
  s.addShape(prs.ShapeType.rect, {
    x: 0.45, y: 0.95, w: 12.4, h: 0.04,
    fill: { type: 'grad', stops: [{position:0,color:INDIGO},{position:50,color:PURPLE},{position:100,color:CYAN}] },
    line: { color: INDIGO, width: 0 },
  });
  s.addText('Nine modules across three phases — Overview, Features, and Operations.', {
    x: 0.45, y: 1.05, w: 12, h: 0.38, fontSize: 11, italic: true, color: GRAY, fontFace: 'Calibri',
  });

  const phases = [
    { title:'OVERVIEW',    color:CYAN,    items:[['1','Platform Introduction'],['2','Key Capabilities'],['3','Problem, Solution & ROI']] },
    { title:'FEATURES',   color:PURPLE,  items:[['4','Terraform Builder'],['5','Cost Intelligence'],['6','Direct Deploy']] },
    { title:'OPERATIONS', color:INDIGO,  items:[['7','Compute Optimizer'],['8','Monitoring & Analytics'],['9','Operations Suite']] },
  ];

  phases.forEach((ph, i) => {
    const x = 0.45 + i * 4.3;
    // Header
    s.addShape(prs.ShapeType.roundRect, {
      x, y: 1.55, w: 4.1, h: 0.5,
      fill: { color: ph.color, transparency: 15 },
      line: { color: ph.color, width: 0.8 },
      rectRadius: 0.08,
    });
    s.addText(ph.title, { x, y: 1.55, w: 4.1, h: 0.5, fontSize: 12, bold: true, color: WHITE, align: 'center', valign: 'middle', fontFace: 'Calibri' });

    ph.items.forEach(([n, label], j) => {
      card(s, x, 2.18+j*1.68, 4.1, 1.52, ph.color);
      numCircle(s, n, x+0.2, 2.38+j*1.68, ph.color);
      s.addText(label, { x:x+0.88, y:2.18+j*1.68, w:3.1, h:1.52, fontSize:12, bold:true, color:WHITE, valign:'middle', fontFace:'Calibri', wrap:true });
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 3 — Problem, Solution & ROI
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = prs.addSlide();
  bg(s);
  orb(s, -1, 3, 4, ORANGE, 0.04);
  orb(s, 9, 1, 4, CYAN, 0.03);

  s.addText('Problem, Solution & ROI', {
    x: 0.45, y: 0.2, w: 12, h: 0.7, fontSize: 34, bold: true, color: WHITE, fontFace: 'Calibri',
  });
  s.addShape(prs.ShapeType.rect, {
    x: 0.45, y: 0.95, w: 12.4, h: 0.04,
    fill: { type: 'grad', stops: [{position:0,color:ORANGE},{position:50,color:YELLOW},{position:100,color:INDIGO}] },
    line: { color: ORANGE, width: 0 },
  });

  // Problems
  s.addText('THE CHALLENGE', { x:0.45, y:1.1, w:5.5, h:0.3, fontSize:10, bold:true, color:ORANGE, fontFace:'Calibri' });
  [
    ['1', ORANGE, 'Disconnected Tooling', '7+ tools per workflow — terminal, Docker, Grafana, CI/CD. Each switch costs 20-25 min of focus.'],
    ['2', YELLOW, 'Manual IaC Authoring', 'Writing Terraform from scratch takes hours and requires specialist knowledge most teams lack.'],
    ['3', PINK,   'Zero Cost Visibility',  'No single place to compare AWS, Azure and GCP costs before provisioning resources at scale.'],
  ].forEach(([n, c, title, desc], i) => {
    card(s, 0.45, 1.45+i*1.78, 6.0, 1.62, c);
    numCircle(s, n, 0.65, 1.68+i*1.78, c);
    s.addText(title, { x:1.32, y:1.65+i*1.78, w:4.9, h:0.4, fontSize:12, bold:true, color:c, fontFace:'Calibri' });
    s.addText(desc,  { x:1.32, y:2.08+i*1.78, w:4.9, h:0.82, fontSize:10, color:SILVER, fontFace:'Calibri', wrap:true });
  });

  // Solution
  s.addText('THE SOLUTION', { x:6.85, y:1.1, w:5.5, h:0.3, fontSize:10, bold:true, color:CYAN, fontFace:'Calibri' });
  s.addShape(prs.ShapeType.roundRect, {
    x:6.85, y:1.45, w:6.05, h:1.68,
    fill: { type: 'grad', stops: [{position:0,color:'0F1D3A'},{position:100,color:'0B1628'}] },
    line: { color: INDIGO, width: 0.8 },
    rectRadius: 0.12,
  });
  s.addText('One platform. Every cloud tool.', { x:7.05, y:1.6, w:5.65, h:0.45, fontSize:15, bold:true, color:WHITE, fontFace:'Calibri' });
  s.addText('InfraStudio unifies IaC design, cost analysis, live deploy, monitoring, and AI automation in a single browser-based workspace.', {
    x:7.05, y:2.1, w:5.65, h:0.85, fontSize:10.5, color:SILVER, fontFace:'Calibri', wrap:true,
  });

  // Payoff
  s.addText('THE PAYOFF', { x:6.85, y:3.3, w:5.5, h:0.3, fontSize:10, bold:true, color:CYAN, fontFace:'Calibri' });
  [[CYAN,'30-40%','Engineering time freed from toil'],[INDIGO,'< 5 min','From idea to deployed IaC'],[PURPLE,'75-80%','Cloud savings identified']].forEach(([c,val,lbl],i) => {
    card(s, 6.85+i*2.05, 3.65, 1.9, 2.45, c);
    s.addText(val, { x:6.85+i*2.05, y:3.9, w:1.9, h:0.85, fontSize:23, bold:true, color:c, align:'center', fontFace:'Calibri' });
    s.addText(lbl, { x:6.85+i*2.05, y:4.8, w:1.9, h:1.0, fontSize:10, color:GRAY, align:'center', fontFace:'Calibri', wrap:true });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 4 — Key Capabilities
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = prs.addSlide();
  bg(s);
  orb(s, 5, 2, 6, INDIGO, 0.03);

  s.addText('Key Capabilities', {
    x:0.45, y:0.2, w:12, h:0.7, fontSize:34, bold:true, color:WHITE, fontFace:'Calibri',
  });
  s.addShape(prs.ShapeType.rect, {
    x:0.45, y:0.95, w:12.4, h:0.04,
    fill:{type:'grad',stops:[{position:0,color:INDIGO},{position:50,color:PURPLE},{position:100,color:CYAN}]},
    line:{color:INDIGO,width:0},
  });
  s.addText('Ten integrated modules covering every stage of the infrastructure lifecycle.', {
    x:0.45, y:1.05, w:12, h:0.35, fontSize:11, italic:true, color:GRAY, fontFace:'Calibri',
  });

  const caps = [
    {icon:'🏗️',title:'Terraform Builder',  color:INDIGO,  desc:'Visual HCL for AWS, Azure & GCP'},
    {icon:'💰',title:'Cost Comparison',    color:PURPLE,  desc:'Live multi-cloud pricing & savings'},
    {icon:'☸️',title:'K8s Costing',        color:CYAN,    desc:'K8s cost explorer with diagrams'},
    {icon:'🚀',title:'Direct Deploy',       color:GREEN,   desc:'Git → K8s, Render, Fly.io'},
    {icon:'⚡',title:'Compute Optimizer',  color:ORANGE,  desc:'AI-powered right-sizing'},
    {icon:'📡',title:'Monitoring',          color:SKY,     desc:'Health, drift & compliance'},
    {icon:'📊',title:'Analytics',           color:GREEN,   desc:'Usage trends & cost insights'},
    {icon:'⚙️',title:'Ansible',             color:PINK,    desc:'Visual playbook builder'},
    {icon:'🔗',title:'Crossplane',          color:CYAN,    desc:'K8s-native cloud resources'},
    {icon:'🤖',title:'Operations Suite',    color:PURPLE,  desc:'AI Agents, vault & schedules'},
  ];

  caps.forEach((c, i) => {
    const col=i%5, row=Math.floor(i/5);
    const x=0.45+col*2.58, y=1.52+row*2.78;
    card(s, x, y, 2.44, 2.62, c.color);
    s.addText(c.icon,  { x, y:y+0.2, w:2.44, h:0.62, fontSize:24, align:'center' });
    s.addText(c.title, { x:x+0.08, y:y+0.9, w:2.28, h:0.42, fontSize:10.5, bold:true, color:c.color, align:'center', fontFace:'Calibri' });
    s.addText(c.desc,  { x:x+0.08, y:y+1.35, w:2.28, h:1.0, fontSize:8.5, color:GRAY, align:'center', fontFace:'Calibri', wrap:true });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 5 — Terraform Builder
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = prs.addSlide();
  bg(s);
  orb(s, 8, -1, 5, INDIGO, 0.05);

  s.addText('Terraform Builder', {
    x:0.45, y:0.2, w:12, h:0.7, fontSize:34, bold:true, color:WHITE, fontFace:'Calibri',
  });
  s.addShape(prs.ShapeType.rect, {
    x:0.45, y:0.95, w:12.4, h:0.04,
    fill:{type:'grad',stops:[{position:0,color:INDIGO},{position:100,color:PURPLE}]},
    line:{color:INDIGO,width:0},
  });
  s.addText('Visual drag-and-drop HCL generation — no Terraform expertise required.', {
    x:0.45, y:1.05, w:12, h:0.35, fontSize:11, italic:true, color:GRAY, fontFace:'Calibri',
  });

  [['🎨',INDIGO, 'Visual Canvas',   'Drag-and-drop resource blocks with live connection mapping and dependency resolution.'],
   ['☁️',PURPLE, 'Multi-Cloud',      'Full AWS, Azure & GCP provider support with 50+ resource types across all services.'],
   ['📄',CYAN,   'HCL Export',       'Download production-ready formatted Terraform files in one click, ready to apply.'],
   ['🔍',SKY,    'Plan Preview',      'Real-time plan preview showing resource changes before committing to infrastructure.'],
   ['📦',GREEN,  'Module Support',    'Reusable modules with variable injection and environment-specific configuration.'],
  ].forEach(([icon,c,title,desc],i) => {
    card(s, 0.45, 1.48+i*1.19, 6.15, 1.08, c);
    s.addText(icon,  { x:0.58, y:1.5+i*1.19, w:0.72, h:1.04, fontSize:22, align:'center', valign:'middle' });
    s.addText(title, { x:1.42, y:1.56+i*1.19, w:5.0, h:0.36, fontSize:12, bold:true, color:c, fontFace:'Calibri' });
    s.addText(desc,  { x:1.42, y:1.95+i*1.19, w:5.0, h:0.46, fontSize:9.5, color:SILVER, fontFace:'Calibri', wrap:true });
  });

  s.addText('BY THE NUMBERS', { x:6.85, y:1.08, w:6, h:0.3, fontSize:10, bold:true, color:INDIGO, fontFace:'Calibri' });
  [['3',CYAN,'Cloud Providers'],['50+',INDIGO,'Resource Types'],['HCL',PURPLE,'Output Format'],['0',GREEN,'Vendor Lock-in']].forEach(([val,c,lbl],i) => {
    const col=i%2, row=Math.floor(i/2);
    const x=6.85+col*3.12, y=1.45+row*2.88;
    card(s, x, y, 2.95, 2.72, c);
    s.addText(val, { x, y:y+0.5, w:2.95, h:1.05, fontSize:44, bold:true, color:c, align:'center', fontFace:'Calibri' });
    s.addText(lbl, { x, y:y+1.65, w:2.95, h:0.6, fontSize:11, color:GRAY, align:'center', fontFace:'Calibri' });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 6 — Cost Intelligence Suite
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = prs.addSlide();
  bg(s);
  orb(s, 6, 4, 5, PURPLE, 0.04);

  s.addText('Cost Intelligence Suite', {
    x:0.45, y:0.2, w:12, h:0.7, fontSize:34, bold:true, color:WHITE, fontFace:'Calibri',
  });
  s.addShape(prs.ShapeType.rect, {
    x:0.45, y:0.95, w:12.4, h:0.04,
    fill:{type:'grad',stops:[{position:0,color:PURPLE},{position:100,color:CYAN}]},
    line:{color:PURPLE,width:0},
  });
  s.addText('Two powerful modules to compare, plan, and optimise your cloud spend before you commit.', {
    x:0.45, y:1.05, w:12, h:0.35, fontSize:11, italic:true, color:GRAY, fontFace:'Calibri',
  });

  card(s, 0.45, 1.48, 6.1, 5.52, PURPLE);
  s.addText('📊  Cost Comparison', { x:0.65, y:1.68, w:5.7, h:0.45, fontSize:14, bold:true, color:PURPLE, fontFace:'Calibri' });
  ['Real-time pricing APIs from AWS, Azure & GCP','Drag-and-drop multi-cloud service comparison','On-prem vs cloud total cost modelling','Savings recommendations with exact percentages','PDF / CSV cost comparison report exports'].forEach((t,i) => {
    s.addShape(prs.ShapeType.ellipse, { x:0.68, y:2.28+i*0.9, w:0.2, h:0.2, fill:{color:PURPLE}, line:{color:PURPLE,width:0} });
    s.addText(t, { x:1.05, y:2.22+i*0.9, w:5.2, h:0.38, fontSize:11, color:SILVER, fontFace:'Calibri' });
  });

  card(s, 6.82, 1.48, 6.1, 5.52, CYAN);
  s.addText('☸️  K8s Costing Explorer', { x:7.02, y:1.68, w:5.7, h:0.45, fontSize:14, bold:true, color:CYAN, fontFace:'Calibri' });
  ['Configure CPU, memory, replicas & storage per workload','Auto-generate Kubernetes architecture diagrams','Per-cloud cost breakdown for EKS, GKE & AKS','Terraform download for complete K8s cluster setup','Side-by-side cluster cost comparison across providers'].forEach((t,i) => {
    s.addShape(prs.ShapeType.ellipse, { x:7.05, y:2.28+i*0.9, w:0.2, h:0.2, fill:{color:CYAN}, line:{color:CYAN,width:0} });
    s.addText(t, { x:7.42, y:2.22+i*0.9, w:5.2, h:0.38, fontSize:11, color:SILVER, fontFace:'Calibri' });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 7 — Direct Deploy
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = prs.addSlide();
  bg(s);
  orb(s, 5, -1, 5, GREEN, 0.04);

  s.addText('Direct Deploy', {
    x:0.45, y:0.2, w:12, h:0.7, fontSize:34, bold:true, color:WHITE, fontFace:'Calibri',
  });
  s.addShape(prs.ShapeType.rect, {
    x:0.45, y:0.95, w:12.4, h:0.04,
    fill:{type:'grad',stops:[{position:0,color:GREEN},{position:100,color:CYAN}]},
    line:{color:GREEN,width:0},
  });
  s.addText('From any Git repository to live cloud infrastructure — five steps, no CI/CD setup required.', {
    x:0.45, y:1.05, w:12, h:0.35, fontSize:11, italic:true, color:GRAY, fontFace:'Calibri',
  });

  [{n:'1',label:'Connect Repo', desc:'Paste any GitHub / GitLab URL — public or private with token',   color:INDIGO},
   {n:'2',label:'Auto-Detect',  desc:'Stack detection: Node, Python, Go, Docker, Java, Ruby and more', color:PURPLE},
   {n:'3',label:'Security Scan',desc:'50+ checks for secrets, CVEs and misconfigurations',              color:ORANGE},
   {n:'4',label:'Generate',     desc:'Dockerfile, Helm charts, K8s manifests and CI/CD pipelines',     color:CYAN  },
   {n:'5',label:'Deploy',       desc:'Push to K8s, EKS, Render, Railway, Fly.io or SSH/VPS targets',  color:GREEN },
  ].forEach((st, i) => {
    const x=0.45+i*2.56;
    card(s, x, 1.48, 2.42, 3.88, st.color);
    s.addShape(prs.ShapeType.ellipse, { x:x+0.88, y:1.7, w:0.64, h:0.64, fill:{color:st.color}, line:{color:st.color,width:0} });
    s.addText(st.n,     { x:x+0.88, y:1.7, w:0.64, h:0.64, fontSize:15, bold:true, color:WHITE, align:'center', valign:'middle', fontFace:'Calibri' });
    s.addText(st.label, { x, y:2.55, w:2.42, h:0.42, fontSize:11.5, bold:true, color:st.color, align:'center', fontFace:'Calibri' });
    s.addText(st.desc,  { x:x+0.12, y:3.05, w:2.18, h:1.18, fontSize:9.5, color:SILVER, align:'center', fontFace:'Calibri', wrap:true });
    if (i<4) s.addText('›', { x:x+2.4, y:2.72, w:0.25, h:0.4, fontSize:20, color:DIM, align:'center' });
  });

  s.addText('DEPLOYMENT TARGETS', { x:0.45, y:5.52, w:6, h:0.28, fontSize:10, bold:true, color:GREEN, fontFace:'Calibri' });
  [['Kubernetes',INDIGO],['Render',GREEN],['Railway',PURPLE],['Fly.io',CYAN],['SSH / VPS',ORANGE]].forEach(([t,c],i) => {
    card(s, 0.45+i*2.56, 5.88, 2.42, 0.68, c);
    s.addText(t, { x:0.45+i*2.56, y:5.88, w:2.42, h:0.68, fontSize:11, bold:true, color:c, align:'center', valign:'middle', fontFace:'Calibri' });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 8 — Optimise & Monitor
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = prs.addSlide();
  bg(s);
  orb(s, -1, 2, 5, ORANGE, 0.04);
  orb(s, 9, 2, 4, SKY, 0.04);

  s.addText('Optimise & Monitor', {
    x:0.45, y:0.2, w:12, h:0.7, fontSize:34, bold:true, color:WHITE, fontFace:'Calibri',
  });
  s.addShape(prs.ShapeType.rect, {
    x:0.45, y:0.95, w:12.4, h:0.04,
    fill:{type:'grad',stops:[{position:0,color:ORANGE},{position:100,color:SKY}]},
    line:{color:ORANGE,width:0},
  });
  s.addText('AI-powered right-sizing and real-time infrastructure health across all cloud providers.', {
    x:0.45, y:1.05, w:12, h:0.35, fontSize:11, italic:true, color:GRAY, fontFace:'Calibri',
  });

  s.addText('COMPUTE OPTIMIZER', { x:0.45, y:1.1, w:5.5, h:0.3, fontSize:10, bold:true, color:ORANGE, fontFace:'Calibri' });
  [['🎯',ORANGE,'Right-Sizing','AI recommendations to up/downgrade instances based on actual CPU and RAM utilisation'],
   ['💲',YELLOW,'Cost Impact','See the exact monthly saving amount before making any changes to your fleet'],
   ['📊',ORANGE,'Utilisation Sim','Simulate CPU / RAM metrics to safely test right-sizing scenarios'],
   ['🔄',YELLOW,'Multi-Cloud Compare','Compare equivalent instance types across AWS, Azure and GCP side-by-side'],
  ].forEach(([icon,c,title,desc],i) => {
    card(s, 0.45, 1.48+i*1.48, 6.1, 1.32, c);
    s.addText(icon,  { x:0.55, y:1.5+i*1.48, w:0.75, h:1.28, fontSize:22, align:'center', valign:'middle' });
    s.addText(title, { x:1.42, y:1.58+i*1.48, w:4.95, h:0.36, fontSize:12, bold:true, color:c, fontFace:'Calibri' });
    s.addText(desc,  { x:1.42, y:1.97+i*1.48, w:4.95, h:0.62, fontSize:9.5, color:SILVER, fontFace:'Calibri', wrap:true });
  });

  s.addText('MONITORING', { x:6.85, y:1.1, w:5.5, h:0.3, fontSize:10, bold:true, color:SKY, fontFace:'Calibri' });
  [['🟢',SKY, 'Health Checks','Real-time infrastructure health with live utilisation metrics per resource'],
   ['🔍',CYAN,'Drift Detection','IaC drift detection and automated compliance scanning across your stack'],
   ['🚨',PINK,'Incident Tracking','Alert management with severity levels, escalation paths and history log'],
   ['📉',SKY, 'Trend Analysis','Resource usage trend analysis and monthly cost forecasting dashboards'],
  ].forEach(([icon,c,title,desc],i) => {
    card(s, 6.85, 1.48+i*1.48, 6.05, 1.32, c);
    s.addText(icon,  { x:6.95, y:1.5+i*1.48, w:0.75, h:1.28, fontSize:22, align:'center', valign:'middle' });
    s.addText(title, { x:7.82, y:1.58+i*1.48, w:4.95, h:0.36, fontSize:12, bold:true, color:c, fontFace:'Calibri' });
    s.addText(desc,  { x:7.82, y:1.97+i*1.48, w:4.95, h:0.62, fontSize:9.5, color:SILVER, fontFace:'Calibri', wrap:true });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 9 — Operations Suite
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = prs.addSlide();
  bg(s);
  orb(s, 5, 3, 6, PURPLE, 0.04);

  s.addText('Operations Suite', {
    x:0.45, y:0.2, w:12, h:0.7, fontSize:34, bold:true, color:WHITE, fontFace:'Calibri',
  });
  s.addShape(prs.ShapeType.rect, {
    x:0.45, y:0.95, w:12.4, h:0.04,
    fill:{type:'grad',stops:[{position:0,color:PURPLE},{position:50,color:INDIGO},{position:100,color:CYAN}]},
    line:{color:PURPLE,width:0},
  });
  s.addText('Orchestrate, automate, and secure your infrastructure with the built-in Oz platform.', {
    x:0.45, y:1.05, w:12, h:0.35, fontSize:11, italic:true, color:GRAY, fontFace:'Calibri',
  });

  [{icon:'🤖',title:'AI Agents',       color:PURPLE,
    desc:'Launch intelligent agents to provision, migrate, or audit infrastructure autonomously. Monitor execution logs in real time.',
    tags:['Auto-provision','Live logs','Multi-step tasks']},
   {icon:'🖥️',title:'Server Registry', color:CYAN,
    desc:'Register and manage SSH and Docker hosts as deployment targets. Agents connect securely via stored credentials.',
    tags:['SSH targets','Docker hosts','Health checks']},
   {icon:'🔑',title:'Secrets Vault',   color:YELLOW,
    desc:'Store cloud credentials, SSH keys and API tokens encrypted at rest with AES-256. Inject securely into agent runs.',
    tags:['AES-256 encrypt','Zero exposure','Scoped access']},
   {icon:'⏰',title:'Schedules',        color:INDIGO,
    desc:'Define cron triggers for recurring agent jobs: nightly backups, compliance scans, cost reports, drift detection.',
    tags:['Cron syntax','Retry logic','Full run history']},
  ].forEach((op, i) => {
    const col=i%2, row=Math.floor(i/2);
    const x=0.45+col*6.5, y=1.48+row*2.85;
    card(s, x, y, 6.28, 2.68, op.color);
    s.addText(op.icon,  { x:x+0.15, y:y+0.18, w:0.78, h:0.78, fontSize:26, align:'center', valign:'middle' });
    s.addText(op.title, { x:x+1.1,  y:y+0.18, w:5.0,  h:0.45, fontSize:14, bold:true, color:op.color, fontFace:'Calibri' });
    s.addText(op.desc,  { x:x+0.15, y:y+0.82, w:5.95, h:1.02, fontSize:9.5, color:SILVER, fontFace:'Calibri', wrap:true });
    op.tags.forEach((tg, j) => {
      tag(s, tg, x+0.15+j*2.08, y+2.26, op.color);
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 10 — Thank You
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = prs.addSlide();
  bg(s);
  orb(s, -1, -1, 7, INDIGO, 0.05);
  orb(s, 8,  3,  6, PURPLE, 0.04);
  orb(s, 4, -2,  5, CYAN,   0.03);

  // Glow box logo
  s.addShape(prs.ShapeType.roundRect, {
    x:5.2, y:0.65, w:2.95, h:2.95,
    fill:{color:SURFACE}, line:{color:INDIGO, width:1.5}, rectRadius:0.32,
    shadow:{type:'outer',color:INDIGO,blur:20,offset:0,angle:0,opacity:0.5},
  });
  s.addText('⚡', { x:5.2, y:0.65, w:2.95, h:2.95, fontSize:62, align:'center', valign:'middle' });

  s.addText('Thank You!', {
    x:0.5, y:3.82, w:12.3, h:1.45,
    fontSize:62, bold:true, color:WHITE, align:'center', fontFace:'Calibri',
  });

  // Gradient underline
  s.addShape(prs.ShapeType.rect, {
    x:3.5, y:5.3, w:6.3, h:0.07,
    fill:{type:'grad',stops:[{position:0,color:INDIGO},{position:50,color:PURPLE},{position:100,color:CYAN}]},
    line:{color:INDIGO,width:0},
  });

  s.addText('InfraStudio — Cloud Infrastructure Command Centre', {
    x:0.5, y:5.52, w:12.3, h:0.45,
    fontSize:15, color:GRAY, align:'center', fontFace:'Calibri',
  });

  // Contact links
  [['🌐','infrastudio.aitglobalindia.com',CYAN],
   ['📧','contact@aitglobalindia.com',    INDIGO],
   ['💻','github.com/ait-global/infrastudio',PURPLE],
  ].forEach(([icon,link,c],i) => {
    const x=1.0+i*3.98;
    card(s, x, 6.18, 3.5, 0.72, c);
    s.addText(`${icon}  ${link}`, { x, y:6.18, w:3.5, h:0.72, fontSize:9.5, color:c, align:'center', valign:'middle', fontFace:'Calibri' });
  });
}

// ── Save ──────────────────────────────────────────────────────────────────
await prs.writeFile({ fileName: 'D:/Kiro/New_Prath/infrastudio/InfraStudio-Dark.pptx' });
console.log('Saved InfraStudio-Dark.pptx (10 slides, dark theme, no AIT branding)');
