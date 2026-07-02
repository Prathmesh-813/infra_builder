import PptxGenJS from 'pptxgenjs';

const prs = new PptxGenJS();
prs.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 inches

// ── AIT Global Template Colours ───────────────────────────────────────────
const NAVY       = '0D1B4B';
const BLUE_HEAD  = '1565C0';  // large slide headings (bright blue like Ozee)
const BLUE_LBL   = '2563EB';  // stripes, buttons
const TEAL       = '0891B2';
const TEAL_GRN   = '0EA47A';
const GREEN      = '16A34A';
const ORANGE     = 'EA580C';
const ORANGE_LBL = 'F97316';
const PURPLE     = '7C3AED';
const WHITE      = 'FFFFFF';
const DARK       = '1E293B';
const MUTED      = '64748B';
const LT_BLUE    = 'EFF6FF'; const BDR_BLUE   = 'BFDBFE';
const LT_PURPLE  = 'F5F3FF'; const BDR_PURPLE = 'DDD6FE';
const LT_GREEN   = 'F0FDF4'; const BDR_GREEN  = 'BBF7D0';
const LT_ORANGE  = 'FFF7ED'; const BDR_ORANGE = 'FED7AA';
const LT_TEAL    = 'ECFEFF'; const BDR_TEAL   = 'A5F3FC';

// ── TITLE SLIDE decorations (top-right stripes + footer right) ────────────
function titleDecor(s) {
  s.addShape(prs.ShapeType.rect, { x:11.2, y:-0.6, w:4.2, h:0.7,  fill:{color:BLUE_LBL}, line:{color:BLUE_LBL,  width:0}, rotate:-45 });
  s.addShape(prs.ShapeType.rect, { x:11.65,y:-0.6, w:3.3, h:0.52, fill:{color:ORANGE},   line:{color:ORANGE,    width:0}, rotate:-45 });
  s.addShape(prs.ShapeType.rect, { x:12.05,y:-0.6, w:2.5, h:0.4,  fill:{color:PURPLE},   line:{color:PURPLE,    width:0}, rotate:-45 });
  s.addText('© Copyright 2026 | AIT Global - Confidential & Proprietary', {
    x:4.6, y:7.18, w:8.5, h:0.25, fontSize:7.5, color:MUTED, fontFace:'Calibri', align:'right',
  });
}

// ── CONTENT SLIDE: AIT GLOBAL logo top-right + bottom-right stripes + footer
function contentDecor(s) {
  // AIT GLOBAL logo (diamond + text) top-right
  s.addShape(prs.ShapeType.roundRect, {
    x:12.3, y:0.08, w:0.55, h:0.55, fill:{color:WHITE},
    line:{color:'2575C4', width:1.5}, rectRadius:0.07, rotate:45,
  });
  s.addText('IS', { x:12.3, y:0.08, w:0.55, h:0.55, fontSize:11, bold:true, color:'2575C4', align:'center', valign:'middle', fontFace:'Calibri' });
  s.addText('AIT GLOBAL', { x:11.88, y:0.65, w:1.4, h:0.28, fontSize:8, bold:true, color:NAVY, align:'center', fontFace:'Calibri' });

  // Bottom-right diagonal stripes
  s.addShape(prs.ShapeType.rect, { x:11.6, y:5.9,  w:4.0, h:0.58, fill:{color:BLUE_LBL}, line:{color:BLUE_LBL, width:0}, rotate:-45 });
  s.addShape(prs.ShapeType.rect, { x:12.05,y:6.35, w:3.2, h:0.45, fill:{color:ORANGE},   line:{color:ORANGE,   width:0}, rotate:-45 });
  s.addShape(prs.ShapeType.rect, { x:12.45,y:6.75, w:2.4, h:0.35, fill:{color:PURPLE},   line:{color:PURPLE,   width:0}, rotate:-45 });

  // Footer bottom-left
  s.addText('© Copyright 2026 | AIT Global - Confidential & Proprietary', {
    x:0.25, y:7.18, w:9, h:0.25, fontSize:7.5, color:MUTED, fontFace:'Calibri',
  });
}

function heading(s, title) {
  s.addText(title, { x:0.25, y:0.08, w:11.9, h:0.7, fontSize:36, bold:true, color:BLUE_HEAD, fontFace:'Calibri' });
  s.addShape(prs.ShapeType.line, { x:0.25, y:0.82, w:12.85, h:0, line:{color:'D1D5DB', width:0.75} });
}
function sub(s, text) {
  if (text) s.addText(text, { x:0.25, y:0.88, w:11.5, h:0.35, fontSize:11, italic:true, color:MUTED, fontFace:'Calibri' });
}
function slab(s, text, x, y, color) {
  s.addText(text, { x, y, w:6, h:0.3, fontSize:10.5, bold:true, color, fontFace:'Calibri' });
}
function card(s, x, y, w, h, bg, bdr) {
  s.addShape(prs.ShapeType.roundRect, { x, y, w, h, fill:{color:bg}, line:{color:bdr, width:0.8}, rectRadius:0.1 });
}
function numCircle(s, n, x, y, color) {
  s.addShape(prs.ShapeType.ellipse, { x, y, w:0.5, h:0.5, fill:{color}, line:{color, width:0} });
  s.addText(String(n), { x, y, w:0.5, h:0.5, fontSize:14, bold:true, color:WHITE, align:'center', valign:'middle', fontFace:'Calibri' });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 1 — Title
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = prs.addSlide();
  s.background = { color:WHITE };
  titleDecor(s);

  // Left navy panel
  s.addShape(prs.ShapeType.rect, { x:0, y:0, w:4.4, h:7.5, fill:{color:NAVY}, line:{color:NAVY, width:0} });

  // Blue angular left-edge accents
  s.addShape(prs.ShapeType.rect, { x:-1.0, y:3.8, w:3.2, h:0.55, fill:{color:'1558A8'}, line:{color:'1558A8', width:0}, rotate:-45 });
  s.addShape(prs.ShapeType.rect, { x:-1.0, y:4.5, w:2.5, h:0.42, fill:{color:'2575C4'}, line:{color:'2575C4', width:0}, rotate:-45 });
  s.addShape(prs.ShapeType.rect, { x:-1.0, y:5.1, w:1.8, h:0.32, fill:{color:'4A90D9'}, line:{color:'4A90D9', width:0}, rotate:-45 });

  // Diamond logo frame
  s.addShape(prs.ShapeType.roundRect, {
    x:0.72, y:1.55, w:2.9, h:2.9,
    fill:{color:WHITE, transparency:8}, line:{color:'4A90D9', width:1.5}, rectRadius:0.22, rotate:45,
  });
  s.addShape(prs.ShapeType.roundRect, {
    x:1.08, y:1.92, w:2.18, h:2.18,
    fill:{color:WHITE, transparency:5}, line:{color:'6EAEE0', width:0.8}, rectRadius:0.18, rotate:45,
  });
  // Blue corner tips
  s.addShape(prs.ShapeType.rect, { x:2.12, y:1.32, w:0.22, h:0.55, fill:{color:'2575C4'}, line:{color:'2575C4',width:0}, rotate:45 });
  s.addShape(prs.ShapeType.rect, { x:0.28, y:2.97, w:0.22, h:0.55, fill:{color:'2575C4'}, line:{color:'2575C4',width:0}, rotate:45 });
  s.addShape(prs.ShapeType.rect, { x:2.12, y:4.62, w:0.22, h:0.55, fill:{color:'2575C4'}, line:{color:'2575C4',width:0}, rotate:45 });
  s.addShape(prs.ShapeType.rect, { x:3.96, y:2.97, w:0.22, h:0.55, fill:{color:'2575C4'}, line:{color:'2575C4',width:0}, rotate:45 });

  s.addText('IS', { x:0.88, y:2.38, w:2.6, h:1.22, fontSize:42, bold:true, color:'1558A8', align:'center', valign:'middle', fontFace:'Calibri' });
  s.addText('INFRASTUDIO', { x:0.1, y:4.88, w:4.2, h:0.45, fontSize:14, bold:true, color:WHITE, align:'center', fontFace:'Calibri' });

  // Right content
  s.addText('InfraStudio', { x:4.75, y:1.4, w:8.2, h:1.32, fontSize:62, bold:true, color:NAVY, fontFace:'Calibri' });
  s.addText('Cloud Infrastructure Command Centre', { x:4.75, y:2.82, w:8.2, h:0.55, fontSize:20, bold:true, color:BLUE_LBL, fontFace:'Calibri' });
  s.addText('Design, compare, and deploy cloud infrastructure from one unified platform', {
    x:4.75, y:3.45, w:8.2, h:0.55, fontSize:13, italic:true, color:MUTED, fontFace:'Calibri',
  });
  s.addShape(prs.ShapeType.line, { x:4.75, y:4.15, w:5.5, h:0, line:{color:'D1D5DB', width:0.6} });
  s.addText([
    {text:'Rohit Darekar', options:{bold:true, color:DARK}},
    {text:'  |  AIT Global Inc     ', options:{color:MUTED}},
    {text:'Amol Funde', options:{bold:true, color:DARK}},
    {text:'  |  AIT Global Inc', options:{color:MUTED}},
  ], { x:4.75, y:4.28, w:8.2, h:0.38, fontSize:12, fontFace:'Calibri' });
  s.addText([
    {text:'Vijay Kadam', options:{bold:true, color:DARK}},
    {text:'  |  AIT Global Inc', options:{color:MUTED}},
  ], { x:4.75, y:4.7, w:8.2, h:0.36, fontSize:12, fontFace:'Calibri' });
  s.addText([
    {text:'Team Name:  ', options:{color:MUTED}},
    {text:'The Orchestrators', options:{bold:true, color:DARK}},
  ], { x:4.75, y:5.1, w:8.2, h:0.36, fontSize:12, fontFace:'Calibri' });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 2 — Presentation Roadmap
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = prs.addSlide();
  s.background = { color:WHITE };
  contentDecor(s);
  heading(s, 'Presentation Roadmap');
  sub(s, 'Nine modules across three phases — Overview, Features, and Operations.');

  const phases = [
    { title:'OVERVIEW',    color:TEAL_GRN, bg:LT_TEAL,   bdr:BDR_TEAL,   items:['1  Platform Introduction','2  Key Capabilities','3  Problem, Solution & ROI'] },
    { title:'FEATURES',   color:PURPLE,   bg:LT_PURPLE, bdr:BDR_PURPLE, items:['4  Terraform Builder','5  Cost Intelligence','6  Direct Deploy'] },
    { title:'OPERATIONS', color:BLUE_LBL, bg:LT_BLUE,   bdr:BDR_BLUE,   items:['7  Compute Optimizer','8  Monitoring & Analytics','9  Operations Suite'] },
  ];
  phases.forEach((ph, i) => {
    const x = 0.25 + i * 4.35;
    s.addShape(prs.ShapeType.roundRect, { x, y:1.32, w:4.1, h:0.52, fill:{color:ph.color}, line:{color:ph.color, width:0}, rectRadius:0.08 });
    s.addText(ph.title, { x, y:1.32, w:4.1, h:0.52, fontSize:13, bold:true, color:WHITE, align:'center', valign:'middle', fontFace:'Calibri' });
    ph.items.forEach((item, j) => {
      card(s, x, 1.98+j*1.72, 4.1, 1.58, ph.bg, ph.bdr);
      numCircle(s, item[0], x+0.22, 2.18+j*1.72, ph.color);
      s.addText(item.slice(3), { x:x+0.9, y:1.98+j*1.72, w:3.1, h:1.58, fontSize:12, bold:true, color:DARK, valign:'middle', fontFace:'Calibri', wrap:true });
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 3 — Problem, Solution & ROI
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = prs.addSlide();
  s.background = { color:WHITE };
  contentDecor(s);
  heading(s, 'Problem, Solution & ROI');

  slab(s, 'THE PROBLEM', 0.25, 0.95, ORANGE_LBL);
  [
    ['1','Disconnected Tooling','7+ tools per workflow — terminal, Docker, Grafana, CI/CD. Each switch costs 20-25 min of focus.'],
    ['2','Manual IaC Authoring','Writing Terraform from scratch takes hours and requires specialist knowledge most teams lack.'],
    ['3','Zero Cost Visibility','No single place to compare AWS, Azure and GCP costs before provisioning resources at scale.'],
  ].forEach(([n, title, desc], i) => {
    card(s, 0.25, 1.3+i*1.75, 6.05, 1.6, LT_ORANGE, BDR_ORANGE);
    numCircle(s, n, 0.42, 1.5+i*1.75, ORANGE_LBL);
    s.addText(title, { x:1.08, y:1.5+i*1.75, w:5.0, h:0.38, fontSize:12, bold:true, color:ORANGE_LBL, fontFace:'Calibri' });
    s.addText(desc,  { x:1.08, y:1.91+i*1.75, w:5.0, h:0.82, fontSize:10, color:DARK, fontFace:'Calibri', wrap:true });
  });

  slab(s, 'THE SOLUTION', 6.65, 0.95, TEAL);
  s.addShape(prs.ShapeType.roundRect, { x:6.65, y:1.3, w:6.3, h:1.65, fill:{color:NAVY}, line:{color:NAVY, width:0}, rectRadius:0.12 });
  s.addText('One platform. Every cloud tool.', { x:6.82, y:1.42, w:5.95, h:0.48, fontSize:16, bold:true, color:WHITE, fontFace:'Calibri' });
  s.addText('InfraStudio unifies IaC design, cost analysis, live deploy, monitoring, and AI automation in a single browser-based workspace.', {
    x:6.82, y:1.95, w:5.95, h:0.82, fontSize:10.5, color:'B0C4E8', fontFace:'Calibri', wrap:true,
  });

  slab(s, 'THE PAYOFF', 6.65, 3.15, TEAL);
  [['30-40%','of eng. time freed from toil',TEAL_GRN,LT_TEAL,BDR_TEAL],
   ['< 5 min','idea to deployed IaC',BLUE_LBL,LT_BLUE,BDR_BLUE],
   ['75-80%','cost savings identified',PURPLE,LT_PURPLE,BDR_PURPLE],
  ].forEach(([val,lbl,c,bg,bdr],i) => {
    card(s, 6.65+i*2.12, 3.5, 1.98, 2.55, bg, bdr);
    s.addText(val, { x:6.65+i*2.12, y:3.72, w:1.98, h:0.85, fontSize:24, bold:true, color:c, align:'center', fontFace:'Calibri' });
    s.addText(lbl, { x:6.65+i*2.12, y:4.62, w:1.98, h:1.05, fontSize:10, color:MUTED, align:'center', fontFace:'Calibri', wrap:true });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 4 — Key Capabilities
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = prs.addSlide();
  s.background = { color:WHITE };
  contentDecor(s);
  heading(s, 'Key Capabilities');
  sub(s, 'Ten integrated modules covering every stage of the infrastructure lifecycle.');

  const caps = [
    {icon:'🏗️',title:'Terraform Builder',  desc:'Visual HCL generation for AWS, Azure & GCP',         bg:LT_BLUE,   bdr:BDR_BLUE,   lc:BLUE_LBL},
    {icon:'💰',title:'Cost Comparison',    desc:'Live multi-cloud pricing & savings recommendations',   bg:LT_PURPLE, bdr:BDR_PURPLE, lc:PURPLE},
    {icon:'☸️',title:'K8s Costing',        desc:'Kubernetes cost explorer with architecture diagrams',  bg:LT_TEAL,   bdr:BDR_TEAL,   lc:TEAL},
    {icon:'🚀',title:'Direct Deploy',       desc:'Git repo to K8s, Render, Railway, Fly.io in steps',   bg:LT_GREEN,  bdr:BDR_GREEN,  lc:GREEN},
    {icon:'⚡',title:'Compute Optimizer',  desc:'AI-powered right-sizing with cost impact analysis',    bg:LT_ORANGE, bdr:BDR_ORANGE, lc:ORANGE},
    {icon:'📡',title:'Monitoring',          desc:'Real-time health, drift detection & incidents',        bg:LT_BLUE,   bdr:BDR_BLUE,   lc:BLUE_LBL},
    {icon:'📊',title:'Analytics',           desc:'Usage trends, cost breakdowns, team insights',         bg:LT_GREEN,  bdr:BDR_GREEN,  lc:GREEN},
    {icon:'⚙️',title:'Ansible',             desc:'Visual playbook builder for config management',        bg:LT_ORANGE, bdr:BDR_ORANGE, lc:ORANGE},
    {icon:'🔗',title:'Crossplane',          desc:'Kubernetes-native cloud resource management',          bg:LT_TEAL,   bdr:BDR_TEAL,   lc:TEAL},
    {icon:'🤖',title:'Operations Suite',    desc:'AI Agents, secrets vault, servers & schedules',        bg:LT_PURPLE, bdr:BDR_PURPLE, lc:PURPLE},
  ];
  caps.forEach((c, i) => {
    const col=i%5, row=Math.floor(i/5);
    const x=0.25+col*2.6, y=1.32+row*2.75;
    card(s, x, y, 2.45, 2.6, c.bg, c.bdr);
    s.addText(c.icon,  { x, y:y+0.18, w:2.45, h:0.6, fontSize:22, align:'center' });
    s.addText(c.title, { x:x+0.08, y:y+0.86, w:2.29, h:0.42, fontSize:10.5, bold:true, color:c.lc, align:'center', fontFace:'Calibri' });
    s.addText(c.desc,  { x:x+0.08, y:y+1.32, w:2.29, h:1.12, fontSize:8.5, color:DARK, align:'center', fontFace:'Calibri', wrap:true });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 5 — Terraform Builder
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = prs.addSlide();
  s.background = { color:WHITE };
  contentDecor(s);
  heading(s, 'Terraform Builder');
  sub(s, 'Visual drag-and-drop HCL infrastructure generation — no Terraform expertise required.');

  [['🎨','Visual Canvas','Drag-and-drop resource blocks with live connection mapping and dependency resolution.'],
   ['☁️','Multi-Cloud','Full AWS, Azure & GCP provider support with 50+ resource types across all services.'],
   ['📄','HCL Export','Download production-ready, formatted Terraform files in one click, ready to apply.'],
   ['🔍','Plan Preview','Real-time plan preview showing resource changes before committing to infrastructure.'],
   ['📦','Module Support','Reusable modules with variable injection and environment-specific configuration.'],
  ].forEach(([icon, title, desc], i) => {
    card(s, 0.25, 1.3+i*1.2, 6.1, 1.08, LT_BLUE, BDR_BLUE);
    s.addText(icon,  { x:0.38, y:1.32+i*1.2, w:0.7, h:1.04, fontSize:20, align:'center', valign:'middle' });
    s.addText(title, { x:1.18, y:1.38+i*1.2, w:5.0, h:0.35, fontSize:12, bold:true, color:BLUE_LBL, fontFace:'Calibri' });
    s.addText(desc,  { x:1.18, y:1.76+i*1.2, w:5.0, h:0.48, fontSize:9.5, color:DARK, fontFace:'Calibri', wrap:true });
  });

  slab(s, 'BY THE NUMBERS', 6.7, 0.95, BLUE_LBL);
  [['3','Cloud Providers',TEAL_GRN,LT_TEAL,BDR_TEAL],
   ['50+','Resource Types',BLUE_LBL,LT_BLUE,BDR_BLUE],
   ['HCL','Output Format',TEAL,LT_TEAL,BDR_TEAL],
   ['Zero','Vendor Lock-in',ORANGE,LT_ORANGE,BDR_ORANGE],
  ].forEach(([val,lbl,c,bg,bdr],i) => {
    const col=i%2, row=Math.floor(i/2);
    const x=6.7+col*3.2, y=1.3+row*2.9;
    card(s, x, y, 3.05, 2.75, bg, bdr);
    s.addText(val, { x, y:y+0.5, w:3.05, h:1.05, fontSize:42, bold:true, color:c, align:'center', fontFace:'Calibri' });
    s.addText(lbl, { x, y:y+1.65, w:3.05, h:0.6, fontSize:11, color:MUTED, align:'center', fontFace:'Calibri' });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 6 — Cost Intelligence Suite
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = prs.addSlide();
  s.background = { color:WHITE };
  contentDecor(s);
  heading(s, 'Cost Intelligence Suite');
  sub(s, 'Two powerful modules to compare, plan, and optimise cloud spend before you commit.');

  card(s, 0.25, 1.3, 6.1, 5.4, LT_PURPLE, BDR_PURPLE);
  s.addText('📊  Cost Comparison', { x:0.45, y:1.5, w:5.7, h:0.45, fontSize:14, bold:true, color:PURPLE, fontFace:'Calibri' });
  ['Real-time pricing APIs from AWS, Azure & GCP',
   'Drag-and-drop multi-cloud service comparison',
   'On-prem vs cloud total cost modelling',
   'Savings recommendations with exact percentages',
   'PDF/CSV cost comparison report exports',
  ].forEach((t,i) => {
    s.addShape(prs.ShapeType.ellipse, { x:0.48, y:2.12+i*0.9, w:0.2, h:0.2, fill:{color:PURPLE}, line:{color:PURPLE, width:0} });
    s.addText(t, { x:0.82, y:2.06+i*0.9, w:5.3, h:0.38, fontSize:11, color:DARK, fontFace:'Calibri' });
  });

  card(s, 6.8, 1.3, 6.12, 5.4, LT_TEAL, BDR_TEAL);
  s.addText('☸️  K8s Costing Explorer', { x:7.0, y:1.5, w:5.7, h:0.45, fontSize:14, bold:true, color:TEAL, fontFace:'Calibri' });
  ['Configure CPU, memory, replicas & storage per workload',
   'Auto-generate Kubernetes architecture diagrams',
   'Per-cloud cost breakdown for EKS, GKE & AKS',
   'Terraform download for complete K8s cluster setup',
   'Side-by-side cluster cost comparison across providers',
  ].forEach((t,i) => {
    s.addShape(prs.ShapeType.ellipse, { x:7.03, y:2.12+i*0.9, w:0.2, h:0.2, fill:{color:TEAL}, line:{color:TEAL, width:0} });
    s.addText(t, { x:7.37, y:2.06+i*0.9, w:5.3, h:0.38, fontSize:11, color:DARK, fontFace:'Calibri' });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 7 — Direct Deploy
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = prs.addSlide();
  s.background = { color:WHITE };
  contentDecor(s);
  heading(s, 'Direct Deploy');
  sub(s, 'From any Git repository to live cloud infrastructure — five steps, no CI/CD setup required.');

  [{n:'1',label:'Connect Repo', desc:'Paste any GitHub / GitLab URL - public or private with token',   color:BLUE_LBL, bg:LT_BLUE,   bdr:BDR_BLUE  },
   {n:'2',label:'Auto-Detect',  desc:'Stack detection: Node, Python, Go, Docker, Java, Ruby and more', color:PURPLE,   bg:LT_PURPLE, bdr:BDR_PURPLE},
   {n:'3',label:'Security Scan',desc:'50+ checks for secrets, CVEs and misconfigurations',              color:ORANGE,   bg:LT_ORANGE, bdr:BDR_ORANGE},
   {n:'4',label:'Generate',     desc:'Dockerfile, Helm charts, K8s manifests and CI/CD pipelines',     color:TEAL,     bg:LT_TEAL,   bdr:BDR_TEAL  },
   {n:'5',label:'Deploy',       desc:'Push to K8s, EKS, Render, Railway, Fly.io or SSH/VPS targets',  color:GREEN,    bg:LT_GREEN,  bdr:BDR_GREEN },
  ].forEach((st, i) => {
    const x=0.25+i*2.58;
    card(s, x, 1.3, 2.44, 3.9, st.bg, st.bdr);
    s.addShape(prs.ShapeType.ellipse, { x:x+0.88, y:1.52, w:0.65, h:0.65, fill:{color:st.color}, line:{color:st.color, width:0} });
    s.addText(st.n,     { x:x+0.88, y:1.52, w:0.65, h:0.65, fontSize:16, bold:true, color:WHITE, align:'center', valign:'middle', fontFace:'Calibri' });
    s.addText(st.label, { x, y:2.38, w:2.44, h:0.42, fontSize:11.5, bold:true, color:st.color, align:'center', fontFace:'Calibri' });
    s.addText(st.desc,  { x:x+0.12, y:2.88, w:2.2, h:1.2, fontSize:9.5, color:DARK, align:'center', fontFace:'Calibri', wrap:true });
    if (i<4) s.addText('>', { x:x+2.43, y:2.7, w:0.25, h:0.42, fontSize:20, color:MUTED, align:'center' });
  });

  slab(s, 'SUPPORTED DEPLOYMENT TARGETS', 0.25, 5.38, BLUE_LBL);
  [['Kubernetes',BLUE_LBL,LT_BLUE,BDR_BLUE],
   ['Render',GREEN,LT_GREEN,BDR_GREEN],
   ['Railway',PURPLE,LT_PURPLE,BDR_PURPLE],
   ['Fly.io',TEAL,LT_TEAL,BDR_TEAL],
   ['SSH / VPS',ORANGE,LT_ORANGE,BDR_ORANGE],
  ].forEach(([t,c,bg,bdr],i) => {
    card(s, 0.25+i*2.58, 5.72, 2.44, 0.7, bg, bdr);
    s.addText(t, { x:0.25+i*2.58, y:5.72, w:2.44, h:0.7, fontSize:11, bold:true, color:c, align:'center', valign:'middle', fontFace:'Calibri' });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 8 — Optimise & Monitor
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = prs.addSlide();
  s.background = { color:WHITE };
  contentDecor(s);
  heading(s, 'Optimise & Monitor');
  sub(s, 'AI-powered right-sizing and real-time infrastructure health across all cloud providers.');

  slab(s, 'COMPUTE OPTIMIZER', 0.25, 0.95, ORANGE_LBL);
  [['🎯','Right-Sizing','AI recommendations to up/downgrade instances based on actual CPU and RAM utilisation'],
   ['💲','Cost Impact','See the exact monthly saving amount before making any changes to your fleet'],
   ['📊','Utilisation Simulation','Simulate CPU / RAM metrics to safely test right-sizing scenarios'],
   ['🔄','Multi-Cloud Compare','Compare equivalent instance types across AWS, Azure and GCP side-by-side'],
  ].forEach(([icon,title,desc],i) => {
    card(s, 0.25, 1.3+i*1.5, 6.1, 1.35, LT_ORANGE, BDR_ORANGE);
    s.addText(icon,  { x:0.35, y:1.32+i*1.5, w:0.75, h:1.3, fontSize:20, align:'center', valign:'middle' });
    s.addText(title, { x:1.2, y:1.4+i*1.5, w:4.95, h:0.38, fontSize:12, bold:true, color:ORANGE_LBL, fontFace:'Calibri' });
    s.addText(desc,  { x:1.2, y:1.81+i*1.5, w:4.95, h:0.65, fontSize:9.5, color:DARK, fontFace:'Calibri', wrap:true });
  });

  slab(s, 'MONITORING', 6.75, 0.95, BLUE_LBL);
  [['🟢','Health Checks','Real-time infrastructure health with live utilisation metrics per resource'],
   ['🔍','Drift Detection','IaC drift detection and automated compliance scanning across your stack'],
   ['🚨','Incident Tracking','Alert management with severity levels, escalation paths and history log'],
   ['📉','Trend Analysis','Resource usage trend analysis and monthly cost forecasting dashboards'],
  ].forEach(([icon,title,desc],i) => {
    card(s, 6.75, 1.3+i*1.5, 6.12, 1.35, LT_BLUE, BDR_BLUE);
    s.addText(icon,  { x:6.85, y:1.32+i*1.5, w:0.75, h:1.3, fontSize:20, align:'center', valign:'middle' });
    s.addText(title, { x:7.72, y:1.4+i*1.5, w:4.95, h:0.38, fontSize:12, bold:true, color:BLUE_LBL, fontFace:'Calibri' });
    s.addText(desc,  { x:7.72, y:1.81+i*1.5, w:4.95, h:0.65, fontSize:9.5, color:DARK, fontFace:'Calibri', wrap:true });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 9 — Operations Suite
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = prs.addSlide();
  s.background = { color:WHITE };
  contentDecor(s);
  heading(s, 'Operations Suite');
  sub(s, 'Orchestrate, automate, and secure your infrastructure with the built-in Oz platform.');

  [{icon:'🤖',title:'AI Agents',       color:PURPLE,   bg:LT_PURPLE, bdr:BDR_PURPLE,
    desc:'Launch intelligent agents to provision, migrate, or audit infrastructure autonomously. Monitor execution logs in real time.',
    tags:['Auto-provision','Live logs','Multi-step tasks']},
   {icon:'🖥️',title:'Server Registry', color:TEAL,     bg:LT_TEAL,   bdr:BDR_TEAL,
    desc:'Register and manage SSH and Docker hosts as deployment targets. Agents connect securely via stored credentials.',
    tags:['SSH targets','Docker hosts','Health checks']},
   {icon:'🔑',title:'Secrets Vault',   color:ORANGE,   bg:LT_ORANGE, bdr:BDR_ORANGE,
    desc:'Store cloud credentials, SSH keys and API tokens encrypted at rest with AES-256. Inject securely into agent runs.',
    tags:['AES-256 encrypt','Zero exposure','Scoped access']},
   {icon:'⏰',title:'Schedules',        color:BLUE_LBL, bg:LT_BLUE,   bdr:BDR_BLUE,
    desc:'Define cron triggers for recurring agent jobs: nightly backups, compliance scans, cost reports, drift detection.',
    tags:['Cron syntax','Retry logic','Full run history']},
  ].forEach((op, i) => {
    const col=i%2, row=Math.floor(i/2);
    const x=0.25+col*6.55, y=1.3+row*2.88;
    card(s, x, y, 6.35, 2.72, op.bg, op.bdr);
    s.addText(op.icon,  { x:x+0.15, y:y+0.18, w:0.75, h:0.78, fontSize:24, align:'center', valign:'middle' });
    s.addText(op.title, { x:x+1.05, y:y+0.18, w:5.0,  h:0.45, fontSize:14, bold:true, color:op.color, fontFace:'Calibri' });
    s.addText(op.desc,  { x:x+0.15, y:y+0.82, w:6.02, h:1.02, fontSize:9.5, color:DARK, fontFace:'Calibri', wrap:true });
    op.tags.forEach((tag, j) => {
      s.addShape(prs.ShapeType.roundRect, { x:x+0.15+j*2.08, y:y+2.28, w:1.92, h:0.3, fill:{color:op.color, transparency:85}, line:{color:op.color, width:0.6}, rectRadius:0.06 });
      s.addText(tag, { x:x+0.15+j*2.08, y:y+2.28, w:1.92, h:0.3, fontSize:8, bold:true, color:op.color, align:'center', valign:'middle', fontFace:'Calibri' });
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 10 — Implementation Plan & Budget
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = prs.addSlide();
  s.background = { color:WHITE };
  contentDecor(s);
  heading(s, 'Implementation Plan & Budget');
  sub(s, 'Phased delivery roadmap and flexible subscription tiers for every team size.');

  slab(s, 'ROADMAP', 0.25, 0.96, BLUE_LBL);
  [{phase:'M1-M3', title:'Foundation', desc:'Core IaC tools live, public beta, first 50 users onboarded',         color:TEAL_GRN, bg:LT_TEAL,   bdr:BDR_TEAL  },
   {phase:'M3-M6', title:'Growth',     desc:'Pro tier + Stripe billing, AI optimizer GA, 100 paying customers',    color:GREEN,    bg:LT_GREEN,  bdr:BDR_GREEN },
   {phase:'M6-M9', title:'Scale',      desc:'Team tier + SSO, operations suite GA, 500 customers, marketplace',    color:PURPLE,   bg:LT_PURPLE, bdr:BDR_PURPLE},
   {phase:'M9-M12',title:'Enterprise', desc:'Enterprise pilots, custom agent integrations, SLA commitments',       color:ORANGE,   bg:LT_ORANGE, bdr:BDR_ORANGE},
  ].forEach((m, i) => {
    card(s, 0.25, 1.3+i*1.52, 6.1, 1.38, m.bg, m.bdr);
    s.addShape(prs.ShapeType.roundRect, { x:0.38, y:1.42+i*1.52, w:1.08, h:0.45, fill:{color:m.color}, line:{color:m.color, width:0}, rectRadius:0.08 });
    s.addText(m.phase, { x:0.38, y:1.42+i*1.52, w:1.08, h:0.45, fontSize:9, bold:true, color:WHITE, align:'center', valign:'middle', fontFace:'Calibri' });
    s.addText(m.title, { x:1.6, y:1.4+i*1.52, w:4.6, h:0.38, fontSize:12, bold:true, color:m.color, fontFace:'Calibri' });
    s.addText(m.desc,  { x:1.6, y:1.81+i*1.52, w:4.6, h:0.7, fontSize:9.5, color:DARK, fontFace:'Calibri', wrap:true });
  });

  slab(s, 'PRICING', 6.75, 0.96, GREEN);
  [{name:'Starter',    price:'Free',   color:TEAL_GRN, bg:LT_TEAL,   bdr:BDR_TEAL,   feat:'Core IaC tools · Basic cost compare · Community support'},
   {name:'Pro',        price:'$29/mo', color:BLUE_LBL, bg:LT_BLUE,   bdr:BDR_BLUE,   feat:'Live pricing APIs · AI optimisation · Priority support'},
   {name:'Team',       price:'$99/mo', color:PURPLE,   bg:LT_PURPLE, bdr:BDR_PURPLE, feat:'SSO · Team audit logs · Shared secrets vault · SLA'},
   {name:'Enterprise', price:'Custom', color:ORANGE,   bg:LT_ORANGE, bdr:BDR_ORANGE, feat:'Custom agents · Dedicated infra · White-label options'},
  ].forEach((p, i) => {
    card(s, 6.75, 1.3+i*1.52, 6.12, 1.38, p.bg, p.bdr);
    s.addText(p.name,  { x:6.92, y:1.38+i*1.52, w:2.5, h:0.42, fontSize:13, bold:true, color:p.color, fontFace:'Calibri' });
    s.addText(p.price, { x:9.5,  y:1.38+i*1.52, w:3.2, h:0.42, fontSize:16, bold:true, color:p.color, align:'right', fontFace:'Calibri' });
    s.addText(p.feat,  { x:6.92, y:1.84+i*1.52, w:5.8, h:0.6, fontSize:9.5, color:MUTED, fontFace:'Calibri' });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 11 — Thank You / Connect With Us  (matches Ozee last slide exactly)
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = prs.addSlide();
  s.background = { color:WHITE };

  // Bottom-right diagonal stripes
  s.addShape(prs.ShapeType.rect, { x:11.6, y:5.9,  w:4.0, h:0.58, fill:{color:BLUE_LBL}, line:{color:BLUE_LBL, width:0}, rotate:-45 });
  s.addShape(prs.ShapeType.rect, { x:12.05,y:6.35, w:3.2, h:0.45, fill:{color:ORANGE},   line:{color:ORANGE,   width:0}, rotate:-45 });
  s.addShape(prs.ShapeType.rect, { x:12.45,y:6.75, w:2.4, h:0.35, fill:{color:PURPLE},   line:{color:PURPLE,   width:0}, rotate:-45 });

  // Blue banner top-left ("Global Presence" equivalent)
  s.addShape(prs.ShapeType.roundRect, { x:0.25, y:0.22, w:4.9, h:0.65, fill:{color:BLUE_HEAD}, line:{color:BLUE_HEAD, width:0}, rectRadius:0.06 });
  s.addText('Connect With Us', { x:0.4, y:0.22, w:4.75, h:0.65, fontSize:16, bold:true, color:WHITE, valign:'middle', fontFace:'Calibri' });

  // Left — contact info (matches Ozee country/address layout)
  [{region:'India',   lines:['Nyati Enthral, Office no 1105, Mundhwa-Kharadi Bypass,','Kharadi, Pune, Maharashtra 411014']},
   {region:'Website', lines:['www.aitglobalindia.com']},
   {region:'Product', lines:['infrastudio.aitglobalindia.com']},
   {region:'GitHub',  lines:['github.com/ait-global/infrastudio']},
  ].forEach((c, i) => {
    const y = 1.1+i*1.45;
    s.addText(c.region, { x:0.25, y, w:5.5, h:0.35, fontSize:12.5, bold:true, color:DARK, fontFace:'Calibri' });
    s.addShape(prs.ShapeType.line, { x:0.25, y:y+0.38, w:5.5, h:0, line:{color:ORANGE_LBL, width:0.75} });
    c.lines.forEach((line, j) => {
      s.addText(line, { x:0.25, y:y+0.52+j*0.35, w:5.5, h:0.35, fontSize:10.5, color:MUTED, fontFace:'Calibri' });
    });
  });

  // Right — AIT Global diamond logo (large, as in Ozee last slide)
  s.addShape(prs.ShapeType.roundRect, {
    x:7.55, y:0.75, w:3.55, h:3.55,
    fill:{color:WHITE}, line:{color:'4A90D9', width:2}, rectRadius:0.35, rotate:45,
  });
  s.addShape(prs.ShapeType.roundRect, {
    x:8.0, y:1.22, w:2.65, h:2.65,
    fill:{color:WHITE}, line:{color:'6EAEE0', width:1}, rectRadius:0.25, rotate:45,
  });
  // Corner tips
  [{x:9.28,y:0.52},{x:7.02,y:2.48},{x:9.28,y:4.42},{x:11.55,y:2.48}].forEach(({x,y}) => {
    s.addShape(prs.ShapeType.rect, { x:x-0.1, y:y-0.25, w:0.2, h:0.55, fill:{color:'2575C4'}, line:{color:'2575C4',width:0}, rotate:45 });
  });
  s.addText('IS', { x:7.78, y:1.68, w:3.02, h:1.65, fontSize:54, bold:true, color:'1558A8', align:'center', valign:'middle', fontFace:'Calibri' });
  s.addText('AIT GLOBAL', { x:7.45, y:4.08, w:3.68, h:0.45, fontSize:16, bold:true, color:NAVY, align:'center', fontFace:'Calibri' });

  // "Thank You!" — large orange, right-aligned (matches Ozee exactly)
  s.addText('Thank You!', {
    x:6.6, y:5.1, w:6.5, h:1.35, fontSize:52, bold:true, color:ORANGE_LBL, fontFace:'Calibri', align:'right',
  });
  s.addText('www.aitglobalindia.com', {
    x:6.6, y:6.38, w:6.5, h:0.38, fontSize:13, bold:true, color:BLUE_LBL, align:'right', fontFace:'Calibri',
  });

  // Footer bottom-left
  s.addText('© Copyright 2026 | AIT Global - Confidential & Proprietary', {
    x:0.25, y:7.18, w:9, h:0.25, fontSize:7.5, color:MUTED, fontFace:'Calibri',
  });
}

// ── Save ──────────────────────────────────────────────────────────────────
await prs.writeFile({ fileName: 'D:/Kiro/New_Prath/infrastudio/InfraStudio-Presentation.pptx' });
console.log('Saved InfraStudio-Presentation.pptx (11 slides)');
