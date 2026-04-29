/* ════════════════════════════════════════════════════════
   OpenClaw FinTrack Universe — Main Application
   Bootstraps data, routes tabs, renders overview charts.
════════════════════════════════════════════════════════ */

const DATA = {
  fintrack: 'data/fintrack.json',
  email:    'data/email.json',
  zendesk:  'data/zendesk.json',
  calendar: 'data/calendar.json',
  contacts: 'data/contacts.json',
};

/* ─── Globals (read by explorer.js too) ─── */
let FT, EM, ZD, CAL, CT;
let CHARTS = {};
let NETWORK = null;
let RENDERED = {};

const PALETTE = [
  '#818cf8','#34d399','#fbbf24','#f87171','#a78bfa',
  '#38bdf8','#fb923c','#4ade80','#e879f9','#22d3ee',
  '#facc15','#60a5fa','#f472b6','#a3e635','#94a3b8',
];

Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = '#1e2d48';
Chart.defaults.font.family = "'Inter', -apple-system, sans-serif";
Chart.defaults.font.size = 12;

const darkGrid  = { color: '#1e2d48' };
const darkTicks = { color: '#94a3b8' };

/* ══════════════════════════════════════
   BOOTSTRAP
══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  await loadAllData();
  renderOverview();
  initExplorer();          /* explorer.js */
  hideSplash();
});

/* ─── Tab routing ─── */
function setupTabs() {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      navigateTo(btn.dataset.tab);
    });
  });
}

function navigateTo(tab) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById(`page-${tab}`);
  if (page) page.classList.add('active');
  document.querySelectorAll('.tab').forEach(b => { if(b.dataset.tab===tab) b.classList.add('active'); else b.classList.remove('active'); });
  if (!RENDERED[tab]) { RENDERED[tab] = true; lazyRender(tab); }
}

function lazyRender(tab) {
  if (!FT) return;
  switch (tab) {
    case 'overview':      renderOverview();      break;
    case 'users':         renderUsersPage();     break;      /* explorer.js */
    case 'accounts':      renderAccountsPage();  break;      /* explorer.js */
    case 'transactions':  renderTransactionsPage(); break;   /* explorer.js */
    case 'subscriptions': renderSubscriptionsPage(); break;  /* explorer.js */
    case 'support':       renderSupportPage();   break;      /* explorer.js */
    case 'network':       renderNetwork();       break;
    case 'scenarios':     initScenarioBuilder(); break;      /* explorer.js */
  }
}

function setStatus(msg) { document.getElementById('status-text').textContent = msg; }
function hideSplash() {
  const el = document.getElementById('loading-overlay');
  el.classList.add('hidden');
  setTimeout(() => el.remove(), 500);
  document.getElementById('status-dot').classList.add('live');
}

/* ══════════════════════════════════════
   DATA LOADING
══════════════════════════════════════ */
async function loadAllData() {
  try {
    setStatus('Fetching data files…');
    const [ft, em, zd, cal, ct] = await Promise.all(
      Object.values(DATA).map(p => fetch(p).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status} loading ${p}`);
        return r.json();
      }))
    );
    FT = ft; EM = em; ZD = zd; CAL = cal; CT = ct;
    setStatus(`${FT.users.length} users · ${FT.accounts.length} accounts · ${FT.transactions.length.toLocaleString()} transactions · ${FT.subscriptions.length} subscriptions · ${ZD.tickets.length} tickets`);
  } catch (err) {
    setStatus('⚠ Error: ' + err.message);
    console.error(err);
  }
}

/* ══════════════════════════════════════
   CHART FACTORY
══════════════════════════════════════ */
function mkChart(id, type, data, options = {}) {
  const ctx = document.getElementById(id);
  if (!ctx) return null;
  if (CHARTS[id]) CHARTS[id].destroy();
  CHARTS[id] = new Chart(ctx, { type, data, options: {
    responsive: true,
    maintainAspectRatio: true,
    plugins: { legend: { labels: { color: '#94a3b8', boxWidth: 11, padding: 12 } } },
    ...options
  }});
  return CHARTS[id];
}

/* ══════════════════════════════════════
   OVERVIEW TAB
══════════════════════════════════════ */
function renderOverview() {
  renderKPIs();
  renderUserAccountsChart();
  renderAccountTypesChart();
  renderServiceCoverageChart();
  renderScenarios();
}

function renderKPIs() {
  const { users, accounts, transactions, subscriptions } = FT;
  const activeSubs = subscriptions.filter(s => s.status === 'Active');
  const totalBal   = accounts.reduce((s,a) => s+a.balance, 0);
  const monthlyEst = activeSubs.reduce((s,sub) => {
    const f = {Monthly:1,Annual:1/12,Weekly:4.33,'Bi-weekly':2.165}[sub.billing_frequency]||1;
    return s + sub.amount * f;
  }, 0);

  const cards = [
    { label:'Total Users',          value: users.length,                        icon:'👤', color:'#818cf8', sub:`All active` },
    { label:'Linked Accounts',      value: accounts.length,                     icon:'🏦', color:'#34d399', sub:`${[...new Set(accounts.map(a=>a.institution_name))].length} institutions` },
    { label:'Transactions',         value: transactions.length.toLocaleString(), icon:'💳', color:'#fbbf24', sub:`Across all users` },
    { label:'Active Subscriptions', value: activeSubs.length,                   icon:'🔄', color:'#a78bfa', sub:`~$${Math.round(monthlyEst).toLocaleString()}/mo est.` },
    { label:'Support Tickets',      value: (ZD.tickets||[]).length,             icon:'🎫', color:'#f87171', sub:`${(EM.emails||[]).length} email threads` },
    { label:'Net Balance (all)',    value:`$${Math.round(totalBal).toLocaleString()}`, icon:'💰', color:'#22d3ee', sub:`Across all accounts` },
  ];

  document.getElementById('kpi-row').innerHTML = cards.map(c => `
    <div class="kpi-card" style="--accent:${c.color}">
      <div class="kpi-icon">${c.icon}</div>
      <div>
        <div class="kpi-value">${c.value}</div>
        <div class="kpi-label">${c.label}</div>
        <div class="kpi-sub">${c.sub}</div>
      </div>
    </div>`).join('');
}

function renderUserAccountsChart() {
  const dist = {};
  FT.users.forEach(u => { dist[u.linked_accounts_count] = (dist[u.linked_accounts_count]||0)+1; });
  const s = Object.entries(dist).sort((a,b) => +a[0]-+b[0]);
  mkChart('c-user-accounts','bar',{
    labels: s.map(([k]) => `${k} acct${k==='1'?'':'s'}`),
    datasets:[{label:'Users',data:s.map(([,v])=>v),backgroundColor:PALETTE[0]+'bb',borderColor:PALETTE[0],borderWidth:1.5,borderRadius:4}]
  },{plugins:{legend:{display:false}},scales:{x:{grid:darkGrid,ticks:darkTicks},y:{grid:darkGrid,ticks:darkTicks}}});
}

function renderAccountTypesChart() {
  const dist = {};
  FT.accounts.forEach(a => { dist[a.account_type]=(dist[a.account_type]||0)+1; });
  const e = Object.entries(dist).sort((a,b)=>b[1]-a[1]);
  mkChart('c-account-types','doughnut',{
    labels:e.map(([k])=>k),
    datasets:[{data:e.map(([,v])=>v),backgroundColor:PALETTE.map(c=>c+'bb'),borderColor:'#0f1829',borderWidth:3}]
  },{plugins:{legend:{position:'right',labels:{color:'#94a3b8',padding:10,boxWidth:9}}},cutout:'60%'});
}

function renderServiceCoverageChart() {
  const svcs = [
    {name:'FinTrack', records: FT.users.length+FT.accounts.length+FT.transactions.length+FT.subscriptions.length},
    {name:'Calendar', records:(CAL.events||[]).length},
    {name:'Contacts', records:(CT.contacts||[]).length},
    {name:'Email',    records:(EM.emails||[]).length},
    {name:'Zendesk',  records:(ZD.tickets||[]).length+(ZD.users||[]).length},
  ];
  mkChart('c-service-coverage','polarArea',{
    labels:svcs.map(s=>s.name),
    datasets:[{data:svcs.map(s=>s.records),backgroundColor:PALETTE.slice(0,5).map(c=>c+'88'),borderColor:PALETTE.slice(0,5),borderWidth:1.5}]
  },{plugins:{legend:{position:'right',labels:{color:'#94a3b8',padding:10,boxWidth:9}}},
    scales:{r:{grid:{color:'#1e2d48'},ticks:{color:'#4b6278',backdropColor:'transparent'}}}});
}

function renderScenarios() {
  const scenarios = [
    { icon:'🔍', title:'Intelligent Account Lookup',
      desc:'Given a user query ("show me my Chase transactions this month"), OpenClaw joins users → accounts → transactions to retrieve perfectly filtered, contextual answers.',
      tags:['FinTrack','Contacts','Tool Use'] },
    { icon:'🚨', title:'Subscription Spend Alert',
      desc:'Cross-reference subscriptions with calendar events to proactively notify users of upcoming charges or flag subscription creep when monthly costs exceed a threshold.',
      tags:['FinTrack','Calendar','Agentic'] },
    { icon:'🎫', title:'Support Ticket Enrichment',
      desc:'When a Zendesk ticket arrives, OpenClaw fetches the user\'s full account + transaction history to give support agents complete context before they even read the ticket.',
      tags:['Zendesk','FinTrack','Contacts'] },
    { icon:'📧', title:'Smart Email Triage',
      desc:'Incoming emails are matched to FinTrack user profiles via email address, enabling OpenClaw to draft personalized responses with account-specific details.',
      tags:['Email','FinTrack','Contacts'] },
    { icon:'📊', title:'Spending Pattern Analysis',
      desc:'Analyze 2,200+ transactions across 150 users to surface insights: category overspend, merchant loyalty, unusual charges, and budget drift.',
      tags:['FinTrack','Analytics','Multi-user'] },
    { icon:'🔗', title:'Cross-Service Entity Resolution',
      desc:'The same person exists in all 5 services. OpenClaw unifies them by email/external_id to build a 360° profile that powers every tool call.',
      tags:['All Services','Identity','Graph'] },
  ];
  document.getElementById('scenarios-grid').innerHTML = scenarios.map(s => `
    <div class="scenario-card">
      <div class="sc-icon">${s.icon}</div>
      <div class="sc-title">${s.title}</div>
      <div class="sc-desc">${s.desc}</div>
      <div class="sc-tags">${s.tags.map(t=>`<span class="sc-tag">${t}</span>`).join('')}</div>
    </div>`).join('');
}

/* ══════════════════════════════════════
   SUBSCRIPTIONS CHARTS (called by explorer.js)
══════════════════════════════════════ */
function renderSubCharts() {
  const counts = {};
  FT.subscriptions.filter(s=>s.status==='Active').forEach(s => { counts[s.service_name]=(counts[s.service_name]||0)+1; });
  const top = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,12);
  mkChart('c-sub-services','bar',{
    labels:top.map(([k])=>k),
    datasets:[{label:'Subscribers',data:top.map(([,v])=>v),backgroundColor:PALETTE[4]+'bb',borderColor:PALETTE[4],borderWidth:1,borderRadius:4}]
  },{indexAxis:'y',plugins:{legend:{display:false}},
    scales:{x:{grid:darkGrid,ticks:{...darkTicks,stepSize:1}},y:{grid:{display:false},ticks:{...darkTicks,font:{size:10}}}}});

  const dist = {};
  FT.subscriptions.filter(s=>s.status==='Active').forEach(s => { dist[s.billing_frequency]=(dist[s.billing_frequency]||0)+1; });
  const e = Object.entries(dist).sort((a,b)=>b[1]-a[1]);
  mkChart('c-billing-freq','pie',{
    labels:e.map(([k])=>k),
    datasets:[{data:e.map(([,v])=>v),backgroundColor:PALETTE.map(c=>c+'bb'),borderColor:'#0f1829',borderWidth:2}]
  },{plugins:{legend:{position:'right',labels:{color:'#94a3b8',padding:10,boxWidth:9}}}});
}

function renderBillingTimeline() {
  const container = document.getElementById('billing-timeline');
  if (!container) return;
  const now = new Date(), end = new Date(now); end.setDate(end.getDate()+60);

  const events = (CAL.events||[]).filter(e => {
    const d = new Date(e.start_datetime*1000); return d>=now && d<=end;
  }).slice(0,100);

  if (!events.length) { container.innerHTML='<p style="color:var(--text3);font-size:12px;padding:16px">No billing events in the next 60 days.</p>'; return; }

  const W = container.clientWidth || 860;
  const ROW_H = 26, LABEL_W = 170, CHART_W = W-LABEL_W-16;
  const byService = {};
  events.forEach(e => {
    const m = e.description?.match(/Subscription: (.+)/); const svc = m?m[1]:e.title;
    if (!byService[svc]) byService[svc]=[];
    byService[svc].push(e);
  });

  const rows = [];
  Object.entries(byService).sort(([a],[b])=>a.localeCompare(b)).forEach(([svc,evts]) => {
    evts.sort((a,b)=>a.start_datetime-b.start_datetime).forEach(ev => rows.push({svc,ev}));
  });

  const colors = {}; [...new Set(rows.map(r=>r.svc))].forEach((s,i) => { colors[s]=PALETTE[i%PALETTE.length]; });
  const toX = d => LABEL_W+(d/60)*CHART_W;
  const ticks = [0,10,20,30,40,50,60].map(i => {
    const d=new Date(now); d.setDate(d.getDate()+i);
    return {x:toX(i), label:d.toLocaleDateString('en-US',{month:'short',day:'numeric'})};
  });

  const H = ROW_H*rows.length+36;
  const svgRows = rows.map(({svc,ev},idx) => {
    const d = new Date(ev.start_datetime*1000);
    const cx = toX((d-now)/86400000);
    const y = idx*ROW_H+32;
    const col = colors[svc];
    const shortSvc = svc.slice(0,22)+(svc.length>22?'…':'');
    const user = ev.attendees?.[0]?.split(' ')[0]||'';
    const amt  = ev.description?.match(/Amount: \$(.+)/)?.[1]||'';
    return `<text x="${LABEL_W-6}" y="${y+9}" text-anchor="end" font-size="10" fill="#4b6278">${escHtml(shortSvc)}</text>
      <circle cx="${cx}" cy="${y+6}" r="5.5" fill="${col}" fill-opacity="0.85"/>
      <text x="${cx+9}" y="${y+11}" font-size="9" fill="#94a3b8">${escHtml(user)}${amt?' · $'+amt:''}</text>`;
  }).join('');

  const tickSvg = ticks.map(t =>
    `<line x1="${t.x}" y1="18" x2="${t.x}" y2="${H-2}" stroke="#1e2d48" stroke-width="1"/>
     <text x="${t.x}" y="12" text-anchor="middle" font-size="9" fill="#4b6278">${t.label}</text>`
  ).join('');

  container.innerHTML = `<svg width="${W}" height="${Math.min(H,500)}" style="overflow:visible;font-family:Inter,sans-serif">${tickSvg}${svgRows}</svg>`;
}

/* ══════════════════════════════════════
   SUPPORT CHARTS (called by explorer.js)
══════════════════════════════════════ */
function classifyTicket(subject) {
  const s = (subject||'').toLowerCase();
  if (s.includes('password')||s.includes('login')||s.includes('access')||s.includes('lock')) return 'Auth & Access';
  if (s.includes('transaction')||s.includes('categor')||s.includes('duplicate')) return 'Transactions';
  if (s.includes('sync')||s.includes('connect')||s.includes('link')) return 'Sync & Connection';
  if (s.includes('subscription')||s.includes('recurring')||s.includes('billing')) return 'Subscriptions';
  if (s.includes('budget')||s.includes('alert')||s.includes('notif')) return 'Budgets & Alerts';
  if (s.includes('export')||s.includes('report')||s.includes('csv')) return 'Export & Reports';
  if (s.includes('mobile')||s.includes('app')||s.includes('crash')) return 'Mobile App';
  if (s.includes('net worth')||s.includes('balance')||s.includes('calculat')) return 'Balance & Net Worth';
  if (s.includes('merchant')||s.includes('logo')) return 'Merchant Data';
  if (s.includes('feature')||s.includes('request')||s.includes('split')||s.includes('tag')||s.includes('goal')||s.includes('cash')||s.includes('venmo')||s.includes('shared')||s.includes('comparison')||s.includes('2fa')||s.includes('two-factor')) return 'Feature Request';
  if (s.includes('invest')) return 'Investments';
  if (s.includes('delete')) return 'Account Management';
  if (s.includes('email')) return 'Email Settings';
  return 'Other';
}

function renderSupportCharts() {
  const cats = {};
  (ZD.tickets||[]).forEach(t => { const c=classifyTicket(t.subject); cats[c]=(cats[c]||0)+1; });
  const e = Object.entries(cats).sort((a,b)=>b[1]-a[1]);
  mkChart('c-ticket-cats','bar',{
    labels:e.map(([k])=>k),
    datasets:[{label:'Tickets',data:e.map(([,v])=>v),backgroundColor:PALETTE[5]+'bb',borderColor:PALETTE[5],borderWidth:1,borderRadius:4}]
  },{indexAxis:'y',plugins:{legend:{display:false}},
    scales:{x:{grid:darkGrid,ticks:{...darkTicks,stepSize:1}},y:{grid:{display:false},ticks:{...darkTicks,font:{size:10}}}}});

  const byDate = {};
  (ZD.tickets||[]).forEach(t => { const d=(t.created_at||'').slice(0,10); if(d) byDate[d]=(byDate[d]||0)+1; });
  const sorted = Object.entries(byDate).sort(([a],[b])=>a.localeCompare(b));
  mkChart('c-ticket-timeline','bar',{
    labels:sorted.map(([d])=>d),
    datasets:[{label:'Tickets',data:sorted.map(([,v])=>v),backgroundColor:PALETTE[2]+'bb',borderColor:PALETTE[2],borderWidth:1,borderRadius:3}]
  },{plugins:{legend:{display:false}},
    scales:{x:{grid:darkGrid,ticks:{...darkTicks,maxRotation:45,font:{size:10}}},y:{grid:darkGrid,ticks:{...darkTicks,stepSize:1}}}});
}

/* ══════════════════════════════════════
   NETWORK GRAPH TAB
══════════════════════════════════════ */
function renderNetwork() {
  if (!NETWORK) NETWORK = new NetworkGraph('network-svg', 'tooltip');
  NETWORK.build(FT, ZD, document.getElementById('cb-tickets')?.checked || false);

  ['users','accounts','merchants','services','tickets'].forEach(key => {
    const cb = document.getElementById(`cb-${key}`);
    if (!cb || cb._bound) return;
    cb._bound = true;
    cb.addEventListener('change', () => {
      const typeMap = {users:'user',accounts:'account',merchants:'merchant',services:'service',tickets:'ticket'};
      const active = ['users','accounts','merchants','services','tickets']
        .filter(k => document.getElementById(`cb-${k}`)?.checked)
        .map(k => typeMap[k]);
      NETWORK.setTypes(active);
    });
  });

  const btn = document.getElementById('btn-reset-zoom');
  if (btn && !btn._bound) { btn._bound=true; btn.addEventListener('click', () => NETWORK.resetZoom()); }
}
