/* ════════════════════════════════════════════════════════
   OpenClaw FinTrack Universe — Main Application
   Loads all 5 service data files and orchestrates
   all charts, the network graph, and interactive views.
════════════════════════════════════════════════════════ */

/* ─── Data file paths (relative to index.html) ─── */
const DATA = {
  fintrack:  'data/fintrack.json',
  email:     'data/email.json',
  zendesk:   'data/zendesk.json',
  calendar:  'data/calendar.json',
  contacts:  'data/contacts.json',
};

/* ─── Global state ─── */
let FT, EM, ZD, CAL, CT;
let CHARTS = {};
let NETWORK = null;
let RENDERED = {};

/* ─── Colour palette ─── */
const PALETTE = [
  '#818cf8','#34d399','#fbbf24','#f87171','#a78bfa',
  '#38bdf8','#fb923c','#4ade80','#e879f9','#22d3ee',
  '#facc15','#60a5fa','#f472b6','#a3e635','#94a3b8',
];

const CHART_DEFAULTS = {
  color: '#94a3b8',
  borderColor: '#1e2d48',
};

/* ── Apply Chart.js global defaults ── */
Chart.defaults.color = CHART_DEFAULTS.color;
Chart.defaults.borderColor = CHART_DEFAULTS.borderColor;
Chart.defaults.font.family = "'Inter', -apple-system, sans-serif";
Chart.defaults.font.size = 12;

/* ══════════════════════════════════════
   BOOTSTRAP
══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  await loadAllData();
  renderOverview();
  hideSplash();
});

/* ─── Tab routing ─── */
function setupTabs() {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById(`page-${tab}`).classList.add('active');
      if (!RENDERED[tab] || tab === 'network') lazyRender(tab);
    });
  });
}

function lazyRender(tab) {
  if (!FT) return;
  RENDERED[tab] = true;
  switch (tab) {
    case 'overview':      renderOverview();      break;
    case 'network':       renderNetwork();       break;
    case 'finance':       renderFinance();       break;
    case 'subscriptions': renderSubscriptions(); break;
    case 'support':       renderSupport();       break;
  }
}

/* ─── Status helpers ─── */
function setStatus(msg) {
  document.getElementById('status-text').textContent = msg;
}
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
      Object.values(DATA).map(path => fetch(path).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status} loading ${path}`);
        return r.json();
      }))
    );
    FT = ft; EM = em; ZD = zd; CAL = cal; CT = ct;
    setStatus(
      `Loaded: ${FT.users.length} users · ${FT.accounts.length} accounts · ` +
      `${FT.transactions.length.toLocaleString()} transactions · ${ZD.tickets.length} tickets`
    );
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
  if (CHARTS[id]) { CHARTS[id].destroy(); }
  CHARTS[id] = new Chart(ctx, { type, data, options: {
    responsive: true,
    maintainAspectRatio: true,
    plugins: { legend: { labels: { color: '#94a3b8', boxWidth: 12, padding: 14 } } },
    ...options
  }});
  return CHARTS[id];
}

const darkGrid = {
  color: '#1e2d48',
  tickColor: '#1e2d48',
};
const darkTicks = { color: '#94a3b8' };

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

/* ─── KPI Cards ─── */
function renderKPIs() {
  const { users, accounts, transactions, subscriptions } = FT;
  const activeSubs = subscriptions.filter(s => s.status === 'Active');
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const avgBalance = totalBalance / accounts.length;
  const tickets = ZD.tickets || [];

  const monthlySubTotal = activeSubs.reduce((s, sub) => {
    const factor = { Monthly: 1, Annual: 1/12, Weekly: 4.33, 'Bi-weekly': 2.165 }[sub.billing_frequency] || 1;
    return s + sub.amount * factor;
  }, 0);

  const cards = [
    { label: 'Total Users',         value: users.length,                             icon: '👤', color: '#818cf8', sub: `${users.filter(u=>u.status==='Active').length} active` },
    { label: 'Linked Accounts',     value: accounts.length,                          icon: '🏦', color: '#34d399', sub: `${[...new Set(accounts.map(a=>a.institution_name))].length} institutions` },
    { label: 'Transactions',        value: transactions.length.toLocaleString(),     icon: '💳', color: '#fbbf24', sub: `$${Math.abs(transactions.reduce((s,t)=>s+t.amount,0)).toLocaleString(undefined,{maximumFractionDigits:0})} total` },
    { label: 'Active Subscriptions',value: activeSubs.length,                        icon: '🔄', color: '#a78bfa', sub: `$${monthlySubTotal.toLocaleString(undefined,{maximumFractionDigits:0})}/mo est.` },
    { label: 'Support Tickets',     value: tickets.length,                           icon: '🎫', color: '#f87171', sub: `${(EM.emails||[]).length} email threads` },
    { label: 'Avg Account Balance', value: `$${Math.round(avgBalance).toLocaleString()}`, icon: '💰', color: '#22d3ee', sub: `$${Math.round(totalBalance).toLocaleString()} total` },
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

/* ─── Users by linked account count (bar) ─── */
function renderUserAccountsChart() {
  const dist = {};
  FT.users.forEach(u => {
    const c = u.linked_accounts_count;
    dist[c] = (dist[c] || 0) + 1;
  });
  const sorted = Object.entries(dist).sort((a,b) => +a[0] - +b[0]);
  mkChart('c-user-accounts', 'bar', {
    labels: sorted.map(([k]) => `${k} account${k==='1'?'':'s'}`),
    datasets: [{ label: 'Users', data: sorted.map(([,v]) => v), backgroundColor: PALETTE[0] + 'cc', borderColor: PALETTE[0], borderWidth: 1.5, borderRadius: 4 }]
  }, {
    plugins: { legend: { display: false } },
    scales: { x: { grid: darkGrid, ticks: darkTicks }, y: { grid: darkGrid, ticks: darkTicks } }
  });
}

/* ─── Account types (doughnut) ─── */
function renderAccountTypesChart() {
  const dist = {};
  FT.accounts.forEach(a => { dist[a.account_type] = (dist[a.account_type] || 0) + 1; });
  const entries = Object.entries(dist).sort((a,b) => b[1]-a[1]);
  mkChart('c-account-types', 'doughnut', {
    labels: entries.map(([k]) => k),
    datasets: [{ data: entries.map(([,v]) => v), backgroundColor: PALETTE.map(c => c + 'cc'), borderColor: '#0f1829', borderWidth: 3 }]
  }, {
    plugins: { legend: { position: 'right', labels: { color: '#94a3b8', padding: 12, boxWidth: 10 } } },
    cutout: '60%'
  });
}

/* ─── Service data coverage (radar/polar) ─── */
function renderServiceCoverageChart() {
  const services = [
    { name: 'FinTrack', records: FT.users.length + FT.accounts.length + FT.transactions.length + FT.subscriptions.length },
    { name: 'Calendar', records: (CAL.events||[]).length },
    { name: 'Contacts', records: (CT.contacts||[]).length },
    { name: 'Email',    records: (EM.emails||[]).length },
    { name: 'Zendesk',  records: (ZD.tickets||[]).length + (ZD.users||[]).length },
  ];
  mkChart('c-service-coverage', 'polarArea', {
    labels: services.map(s => s.name),
    datasets: [{ data: services.map(s => s.records), backgroundColor: PALETTE.slice(0,5).map(c => c + '88'), borderColor: PALETTE.slice(0,5), borderWidth: 1.5 }]
  }, {
    plugins: { legend: { position: 'right', labels: { color: '#94a3b8', padding: 10, boxWidth: 10 } } },
    scales: { r: { grid: { color: '#1e2d48' }, ticks: { color: '#4b6278', backdropColor: 'transparent' } } }
  });
}

/* ─── OpenClaw Scenarios ─── */
function renderScenarios() {
  const scenarios = [
    {
      icon: '🔍',
      title: 'Intelligent Account Lookup',
      desc: 'Given a user query ("show me my Chase transactions this month"), OpenClaw joins users → accounts → transactions to retrieve a perfectly filtered, contextual answer.',
      tags: ['FinTrack', 'Contacts', 'Tool Use'],
    },
    {
      icon: '🚨',
      title: 'Subscription Spend Alert',
      desc: 'Cross-reference subscriptions with calendar events to proactively notify users of upcoming charges, or flag "subscription creep" where monthly costs exceed a threshold.',
      tags: ['FinTrack', 'Calendar', 'Agentic'],
    },
    {
      icon: '🎫',
      title: 'Support Ticket Enrichment',
      desc: 'When a Zendesk ticket arrives, OpenClaw fetches the user\'s account + transaction history to give support agents full context before they even read the ticket.',
      tags: ['Zendesk', 'FinTrack', 'Contacts'],
    },
    {
      icon: '📧',
      title: 'Smart Email Triage',
      desc: 'Incoming emails are matched to FinTrack user profiles via email address, enabling OpenClaw to draft personalized responses with account-specific details.',
      tags: ['Email', 'FinTrack', 'Contacts'],
    },
    {
      icon: '📊',
      title: 'Spending Pattern Analysis',
      desc: 'Analyze 2,200+ transactions across 150 users to surface spending insights: category overspend, merchant loyalty, unusual charges, and budget drift.',
      tags: ['FinTrack', 'Analytics', 'Multi-user'],
    },
    {
      icon: '🔗',
      title: 'Cross-Service Entity Resolution',
      desc: 'Match the same person across all 5 services (by email, external_id, name) to build a unified 360° profile powering every OpenClaw tool call.',
      tags: ['All Services', 'Identity', 'Graph'],
    },
  ];
  document.getElementById('scenarios-grid').innerHTML = scenarios.map(s => `
    <div class="scenario-card">
      <div class="sc-icon">${s.icon}</div>
      <div class="sc-title">${s.title}</div>
      <div class="sc-desc">${s.desc}</div>
      <div class="sc-tags">${s.tags.map(t => `<span class="sc-tag">${t}</span>`).join('')}</div>
    </div>`).join('');
}

/* ══════════════════════════════════════
   NETWORK GRAPH TAB
══════════════════════════════════════ */
function renderNetwork() {
  if (!NETWORK) {
    NETWORK = new NetworkGraph('network-svg', 'tooltip');
  }
  const showTickets = document.getElementById('cb-tickets').checked;
  NETWORK.build(FT, ZD, showTickets);

  /* Filter checkboxes */
  ['users','accounts','merchants','services','tickets'].forEach(key => {
    const cb = document.getElementById(`cb-${key}`);
    cb.addEventListener('change', () => {
      const typeMap = { users: 'user', accounts: 'account', merchants: 'merchant', services: 'service', tickets: 'ticket' };
      const active = ['users','accounts','merchants','services','tickets']
        .filter(k => document.getElementById(`cb-${k}`).checked)
        .map(k => typeMap[k]);
      NETWORK.setTypes(active);
    });
  });

  document.getElementById('btn-reset-zoom').addEventListener('click', () => NETWORK.resetZoom());
}

/* ══════════════════════════════════════
   FINANCE TAB
══════════════════════════════════════ */
function renderFinance() {
  renderSpendingByCategory();
  renderMonthlyTrend();
  renderTopMerchants();
  renderBalanceDist();
}

/* ─── Spending by Category (doughnut) ─── */
function renderSpendingByCategory() {
  const catTotals = {};
  FT.transactions.forEach(t => {
    if (t.amount < 0) catTotals[t.category] = (catTotals[t.category] || 0) + Math.abs(t.amount);
  });
  const entries = Object.entries(catTotals).sort((a,b) => b[1]-a[1]);
  mkChart('c-spending-cat', 'doughnut', {
    labels: entries.map(([k]) => k),
    datasets: [{ data: entries.map(([,v]) => +v.toFixed(0)), backgroundColor: PALETTE.map(c => c + 'cc'), borderColor: '#0f1829', borderWidth: 2 }]
  }, {
    plugins: {
      legend: { position: 'right', labels: { color: '#94a3b8', padding: 10, boxWidth: 10 } },
      tooltip: { callbacks: { label: ctx => ` ${ctx.label}: $${ctx.parsed.toLocaleString()}` } }
    },
    cutout: '55%',
  });
}

/* ─── Monthly Spending Trend (line) ─── */
function renderMonthlyTrend() {
  const monthly = {};
  FT.transactions.forEach(t => {
    if (t.amount >= 0) return;
    const m = t.date.slice(0, 7);
    monthly[m] = (monthly[m] || 0) + Math.abs(t.amount);
  });
  const sorted = Object.entries(monthly).sort(([a], [b]) => a.localeCompare(b)).slice(-14);
  mkChart('c-monthly-trend', 'line', {
    labels: sorted.map(([k]) => k),
    datasets: [{
      label: 'Total Spending ($)',
      data: sorted.map(([,v]) => +v.toFixed(0)),
      borderColor: PALETTE[0],
      backgroundColor: PALETTE[0] + '22',
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: PALETTE[0],
      fill: true,
      tension: 0.4,
    }]
  }, {
    plugins: { legend: { display: false },
      tooltip: { callbacks: { label: ctx => ` $${ctx.parsed.y.toLocaleString()}` } }
    },
    scales: {
      x: { grid: darkGrid, ticks: { ...darkTicks, maxRotation: 45 } },
      y: { grid: darkGrid, ticks: { ...darkTicks, callback: v => `$${(v/1000).toFixed(0)}k` } }
    }
  });
}

/* ─── Top Merchants (horizontal bar) ─── */
function renderTopMerchants() {
  const vol = {};
  FT.transactions.forEach(t => {
    if (t.amount < 0) vol[t.merchant] = (vol[t.merchant] || 0) + Math.abs(t.amount);
  });
  const top = Object.entries(vol).sort((a,b) => b[1]-a[1]).slice(0, 12);
  mkChart('c-top-merchants', 'bar', {
    labels: top.map(([k]) => k),
    datasets: [{ label: 'Volume ($)', data: top.map(([,v]) => +v.toFixed(0)), backgroundColor: PALETTE.map(c => c + 'cc'), borderColor: PALETTE, borderWidth: 1, borderRadius: 4 }]
  }, {
    indexAxis: 'y',
    plugins: { legend: { display: false },
      tooltip: { callbacks: { label: ctx => ` $${ctx.parsed.x.toLocaleString()}` } }
    },
    scales: {
      x: { grid: darkGrid, ticks: { ...darkTicks, callback: v => `$${(v/1000).toFixed(0)}k` } },
      y: { grid: { display: false }, ticks: darkTicks }
    }
  });
}

/* ─── Account Balance Distribution (histogram) ─── */
function renderBalanceDist() {
  const buckets = [
    { label: '<$0',          min: -Infinity, max: 0 },
    { label: '$0–1k',        min: 0,         max: 1000 },
    { label: '$1k–5k',       min: 1000,      max: 5000 },
    { label: '$5k–10k',      min: 5000,      max: 10000 },
    { label: '$10k–25k',     min: 10000,     max: 25000 },
    { label: '$25k–50k',     min: 25000,     max: 50000 },
    { label: '>$50k',        min: 50000,     max: Infinity },
  ];
  buckets.forEach(b => { b.count = 0; });
  FT.accounts.forEach(a => {
    const b = buckets.find(b => a.balance >= b.min && a.balance < b.max);
    if (b) b.count++;
  });
  mkChart('c-balance-dist', 'bar', {
    labels: buckets.map(b => b.label),
    datasets: [{ label: 'Accounts', data: buckets.map(b => b.count), backgroundColor: PALETTE[1] + 'cc', borderColor: PALETTE[1], borderWidth: 1.5, borderRadius: 4 }]
  }, {
    plugins: { legend: { display: false } },
    scales: { x: { grid: darkGrid, ticks: darkTicks }, y: { grid: darkGrid, ticks: { ...darkTicks, stepSize: 1 } } }
  });
}

/* ══════════════════════════════════════
   SUBSCRIPTIONS TAB
══════════════════════════════════════ */
function renderSubscriptions() {
  renderSubServices();
  renderBillingFreq();
  renderBillingTimeline();
  renderUserSubCost();
}

/* ─── Top services by subscriber count (horizontal bar) ─── */
function renderSubServices() {
  const counts = {};
  FT.subscriptions.forEach(s => {
    if (s.status === 'Active') counts[s.service_name] = (counts[s.service_name] || 0) + 1;
  });
  const top = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 12);
  mkChart('c-sub-services', 'bar', {
    labels: top.map(([k]) => k),
    datasets: [{ label: 'Subscribers', data: top.map(([,v]) => v), backgroundColor: PALETTE[4] + 'cc', borderColor: PALETTE[4], borderWidth: 1, borderRadius: 4 }]
  }, {
    indexAxis: 'y',
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: darkGrid, ticks: { ...darkTicks, stepSize: 1 } },
      y: { grid: { display: false }, ticks: { ...darkTicks, font: { size: 11 } } }
    }
  });
}

/* ─── Billing frequency (pie) ─── */
function renderBillingFreq() {
  const dist = {};
  FT.subscriptions.filter(s => s.status === 'Active').forEach(s => {
    dist[s.billing_frequency] = (dist[s.billing_frequency] || 0) + 1;
  });
  const entries = Object.entries(dist).sort((a,b) => b[1]-a[1]);
  mkChart('c-billing-freq', 'pie', {
    labels: entries.map(([k]) => k),
    datasets: [{ data: entries.map(([,v]) => v), backgroundColor: PALETTE.map(c => c + 'cc'), borderColor: '#0f1829', borderWidth: 2 }]
  }, {
    plugins: { legend: { position: 'right', labels: { color: '#94a3b8', padding: 12, boxWidth: 10 } } }
  });
}

/* ─── Billing timeline SVG (next 60 days) ─── */
function renderBillingTimeline() {
  const container = document.getElementById('billing-timeline');
  const now = new Date();
  const end = new Date(now); end.setDate(end.getDate() + 60);

  /* Get calendar events in range */
  const events = (CAL.events || []).filter(e => {
    const d = new Date(e.start_datetime * 1000);
    return d >= now && d <= end;
  }).slice(0, 80);

  if (!events.length) {
    container.innerHTML = '<p style="color:#4b6278;font-size:13px;padding:20px">No upcoming billing events in the next 60 days.</p>';
    return;
  }

  const W = container.clientWidth || 900;
  const ROW_H = 28;
  const LABEL_W = 180;
  const CHART_W = W - LABEL_W - 20;
  const svgH = ROW_H * events.length + 40;

  /* Group by service */
  const byService = {};
  events.forEach(e => {
    const m = e.description?.match(/Subscription: (.+)/);
    const service = m ? m[1] : e.title;
    if (!byService[service]) byService[service] = [];
    byService[service].push(e);
  });

  const rows = [];
  Object.entries(byService).sort(([a], [b]) => a.localeCompare(b)).forEach(([svc, evts]) => {
    evts.sort((a,b) => a.start_datetime - b.start_datetime).forEach(ev => {
      rows.push({ service: svc, event: ev });
    });
  });

  const totalDays = 60;
  const toX = (d) => LABEL_W + (d / totalDays) * CHART_W;

  const colors = {};
  [...new Set(rows.map(r => r.service))].forEach((s, i) => { colors[s] = PALETTE[i % PALETTE.length]; });

  /* Build month tick labels */
  const ticks = [];
  for (let i = 0; i <= 60; i += 10) {
    const d = new Date(now); d.setDate(d.getDate() + i);
    ticks.push({ x: toX(i), label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) });
  }

  const svgRows = rows.map((r, idx) => {
    const evDate = new Date(r.event.start_datetime * 1000);
    const daysFromNow = (evDate - now) / 86400000;
    const cx = toX(daysFromNow);
    const y = idx * ROW_H + 30;
    const mAmt = r.event.description?.match(/Amount: \$(.+)/)?.[1] || '';
    const col = colors[r.service];
    const shortSvc = r.service.slice(0, 22) + (r.service.length > 22 ? '…' : '');
    const shortUser = r.event.attendees?.[0]?.split(' ')[0] || '';

    return `
      <text x="${LABEL_W - 8}" y="${y + 10}" text-anchor="end" font-size="10" fill="#64748b">${shortSvc}</text>
      <circle cx="${cx}" cy="${y + 8}" r="6" fill="${col}" fill-opacity="0.85" stroke="${col}" stroke-width="1.5"/>
      <text x="${cx + 10}" y="${y + 13}" font-size="9" fill="#94a3b8">${shortUser}${mAmt ? ' · $' + mAmt : ''}</text>
    `;
  }).join('');

  const tickSvg = ticks.map(t =>
    `<line x1="${t.x}" y1="20" x2="${t.x}" y2="${svgH - 4}" stroke="#1e2d48" stroke-width="1"/>
     <text x="${t.x}" y="14" text-anchor="middle" font-size="9" fill="#4b6278">${t.label}</text>`
  ).join('');

  container.innerHTML = `
    <svg width="${W}" height="${Math.min(svgH, 600)}" style="overflow:visible;font-family:Inter,sans-serif">
      ${tickSvg}
      ${svgRows}
    </svg>`;
}

/* ─── User subscription monthly cost (bar) ─── */
function renderUserSubCost() {
  const userCostMap = {};
  FT.subscriptions.filter(s => s.status === 'Active').forEach(s => {
    const factor = { Monthly: 1, Annual: 1/12, Weekly: 4.33, 'Bi-weekly': 2.165 }[s.billing_frequency] || 1;
    userCostMap[s.user_id] = (userCostMap[s.user_id] || 0) + s.amount * factor;
  });

  const userNames = {};
  FT.users.forEach(u => { userNames[u.user_id] = u.name.split(' ')[0] + ' ' + u.name.split(' ').slice(-1)[0][0] + '.'; });

  const top25 = Object.entries(userCostMap)
    .sort((a,b) => b[1]-a[1]).slice(0,25);

  mkChart('c-user-sub-cost', 'bar', {
    labels: top25.map(([id]) => userNames[id] || id),
    datasets: [{ label: 'Monthly Cost ($)', data: top25.map(([,v]) => +v.toFixed(2)), backgroundColor: PALETTE[3] + 'cc', borderColor: PALETTE[3], borderWidth: 1, borderRadius: 4 }]
  }, {
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => ` $${ctx.parsed.y.toFixed(2)}/mo` } }
    },
    scales: {
      x: { grid: darkGrid, ticks: { ...darkTicks, maxRotation: 45, font: { size: 10 } } },
      y: { grid: darkGrid, ticks: { ...darkTicks, callback: v => `$${v}` } }
    }
  });
}

/* ══════════════════════════════════════
   SUPPORT TAB
══════════════════════════════════════ */
function renderSupport() {
  renderTicketCategories();
  renderTicketTimeline();
  renderTicketsTable();
}

/* ─── Classify ticket subjects into buckets ─── */
function classifyTicket(subject) {
  const s = (subject || '').toLowerCase();
  if (s.includes('password') || s.includes('login') || s.includes('access') || s.includes('lock')) return 'Auth & Access';
  if (s.includes('transaction') || s.includes('categor')) return 'Transaction Issues';
  if (s.includes('sync') || s.includes('connect') || s.includes('link')) return 'Account Sync';
  if (s.includes('subscription') || s.includes('recurring') || s.includes('billing')) return 'Subscriptions';
  if (s.includes('budget') || s.includes('alert') || s.includes('notif')) return 'Budgets & Alerts';
  if (s.includes('export') || s.includes('report') || s.includes('csv')) return 'Export & Reports';
  if (s.includes('mobile') || s.includes('app') || s.includes('crash')) return 'Mobile App';
  if (s.includes('net worth') || s.includes('balance') || s.includes('calculat')) return 'Balance & Net Worth';
  if (s.includes('merchant') || s.includes('logo')) return 'Merchant Data';
  if (s.includes('feature') || s.includes('request') || s.includes('support') || s.includes('split')) return 'Feature Request';
  return 'Other';
}

function renderTicketCategories() {
  const cats = {};
  (ZD.tickets || []).forEach(t => {
    const c = classifyTicket(t.subject);
    cats[c] = (cats[c] || 0) + 1;
  });
  /* Also count email subjects */
  (EM.emails || []).forEach(e => {
    const c = classifyTicket(e.subject);
    cats[c] = (cats[c] || 0) + 0.5;
  });
  const entries = Object.entries(cats).sort((a,b) => b[1]-a[1]);
  mkChart('c-ticket-cats', 'bar', {
    labels: entries.map(([k]) => k),
    datasets: [{ label: 'Count', data: entries.map(([,v]) => Math.round(v)), backgroundColor: PALETTE[5] + 'cc', borderColor: PALETTE[5], borderWidth: 1, borderRadius: 4 }]
  }, {
    indexAxis: 'y',
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: darkGrid, ticks: { ...darkTicks, stepSize: 1 } },
      y: { grid: { display: false }, ticks: { ...darkTicks, font: { size: 11 } } }
    }
  });
}

function renderTicketTimeline() {
  const byDate = {};
  (ZD.tickets || []).forEach(t => {
    const d = (t.created_at || '').slice(0,10);
    if (d) byDate[d] = (byDate[d] || 0) + 1;
  });
  const sorted = Object.entries(byDate).sort(([a],[b]) => a.localeCompare(b));
  mkChart('c-ticket-timeline', 'bar', {
    labels: sorted.map(([d]) => d),
    datasets: [{ label: 'Tickets', data: sorted.map(([,v]) => v), backgroundColor: PALETTE[2] + 'cc', borderColor: PALETTE[2], borderWidth: 1, borderRadius: 3 }]
  }, {
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: darkGrid, ticks: { ...darkTicks, maxRotation: 45, font: { size: 10 } } },
      y: { grid: darkGrid, ticks: { ...darkTicks, stepSize: 1 } }
    }
  });
}

function renderTicketsTable() {
  const zdUserMap = {};
  (ZD.users || []).forEach(u => { zdUserMap[u.id] = u; });

  const rows = (ZD.tickets || []).map(t => {
    const req = zdUserMap[t.requester_id];
    const extId = req?.external_id || '—';
    const ftUser = FT.users.find(u => u.user_id === extId);
    return { t, req, extId, ftUser };
  });

  const html = `
    <table class="data-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Subject</th>
          <th>Requester</th>
          <th>FinTrack ID</th>
          <th>Status</th>
          <th>Priority</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(({ t, req, extId, ftUser }) => `
          <tr>
            <td>${t.external_id || 'TKT' + t.id}</td>
            <td>${(t.subject || '').slice(0, 55)}${(t.subject || '').length > 55 ? '…' : ''}</td>
            <td>${req?.name || '—'}</td>
            <td>${ftUser ? `${extId}` : extId}</td>
            <td><span class="badge badge-${t.status}">${t.status}</span></td>
            <td><span class="badge badge-${t.priority || 'normal'}">${t.priority || 'normal'}</span></td>
            <td>${(t.created_at || '').slice(0,10)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  document.getElementById('tickets-table').innerHTML = html;
}
