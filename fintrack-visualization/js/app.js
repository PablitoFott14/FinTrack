/* ════════════════════════════════════════════════════════
   FinTrack · OpenClaw — Main App
   Bootstraps data, routes tabs, renders overview.
════════════════════════════════════════════════════════ */

const DATA_PATHS = {
  fintrack: 'data/fintrack.json',
  email:    'data/email.json',
  zendesk:  'data/zendesk.json',
  calendar: 'data/calendar.json',
  contacts: 'data/contacts.json',
};

/* ─── Globals shared with explorer.js ─── */
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

const DG = { color: '#1e2d48' };
const DT = { color: '#94a3b8' };

/* ══════════════════════════════════════
   BOOTSTRAP
══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  await loadAllData();
  renderOverview();
  initExplorer();
  hideSplash();
});

function setupTabs() {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.tab));
  });
}

function navigateTo(tab) {
  document.querySelectorAll('.tab').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.page').forEach(p =>
    p.classList.toggle('active', p.id === `page-${tab}`));
  if (!RENDERED[tab]) { RENDERED[tab] = true; lazyRender(tab); }
}

function lazyRender(tab) {
  if (!FT) return;
  switch (tab) {
    case 'overview':      renderOverview();         break;
    case 'users':         renderUsersPage();        break;
    case 'accounts':      renderAccountsPage();     break;
    case 'transactions':  renderTransactionsPage(); break;
    case 'subscriptions': renderSubscriptionsPage();break;
    case 'support':       renderSupportPage();      break;
    case 'scenarios':     initScenarioBuilder();    break;
    case 'integrity':     renderIntegrityPage();    break;
    case 'network':       renderNetwork();          break;
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
  setStatus('Loading data…');
  try {
    const [ft, em, zd, cal, ct] = await Promise.all(
      Object.values(DATA_PATHS).map(p => fetch(p).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${p}`);
        return r.json();
      }))
    );
    FT = ft; EM = em; ZD = zd; CAL = cal; CT = ct;
    setStatus(
      `${FT.users.length} users · ${FT.accounts.length} accounts · ` +
      `${FT.transactions.length.toLocaleString()} transactions · ` +
      `${FT.subscriptions.length} subscriptions · ${(ZD.tickets||[]).length} tickets`
    );
  } catch (err) {
    setStatus('⚠ ' + err.message);
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
    responsive: true, maintainAspectRatio: true,
    plugins: { legend: { labels: { color: '#94a3b8', boxWidth: 10, padding: 12 } } },
    ...options
  }});
  return CHARTS[id];
}

/* ══════════════════════════════════════
   OVERVIEW
══════════════════════════════════════ */
function renderOverview() {
  renderKPIs();
  renderAlerts();
  renderSpendingChart();
  renderAccountTypesChart();
}

function renderKPIs() {
  const { users, accounts, transactions, subscriptions } = FT;
  const activeSubs = subscriptions.filter(s => s.status === 'Active');
  const totalBal = accounts.reduce((s,a) => s+a.balance, 0);
  const monthlyEst = activeSubs.reduce((s,sub) => {
    return s + sub.amount * ({Monthly:1,Annual:1/12,Weekly:4.33,'Bi-weekly':2.165}[sub.billing_frequency]||1);
  }, 0);

  const cards = [
    { label:'Users',           value: users.length,                        icon:'👤', color:'#818cf8', sub:'All active' },
    { label:'Linked Accounts', value: accounts.length,                     icon:'🏦', color:'#34d399', sub:`${[...new Set(accounts.map(a=>a.institution_name))].length} institutions` },
    { label:'Transactions',    value: transactions.length.toLocaleString(), icon:'💳', color:'#fbbf24', sub:'Total recorded' },
    { label:'Active Subscriptions', value: activeSubs.length,              icon:'🔄', color:'#a78bfa', sub:`~$${Math.round(monthlyEst).toLocaleString()}/mo` },
    { label:'Support Tickets', value: (ZD.tickets||[]).length,             icon:'🎫', color:'#f87171', sub:`${(EM.emails||[]).length} email threads` },
    { label:'Net Balance',     value:`$${Math.round(totalBal).toLocaleString()}`, icon:'💰', color:'#22d3ee', sub:'All accounts' },
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

function renderAlerts() {
  const alerts = [];

  /* High-value transactions (abs > $500) */
  const bigTx = FT.transactions.filter(t => Math.abs(t.amount) > 500);
  if (bigTx.length) {
    const top = bigTx.sort((a,b) => Math.abs(b.amount)-Math.abs(a.amount))[0];
    const u = FT.users.find(x => x.user_id === top.user_id);
    alerts.push({ icon:'🚨', title:`${bigTx.length} high-value transactions (>$500)`, sub:`Largest: $${Math.abs(top.amount).toFixed(2)} at ${top.merchant} by ${u?.name||top.user_id}`, onclick:`openTransactionModal('${top.transaction_id}')` });
  }

  /* Open support tickets */
  const openTkts = (ZD.tickets||[]).filter(t => t.status === 'open');
  if (openTkts.length) {
    alerts.push({ icon:'🎫', title:`${openTkts.length} open support tickets`, sub:`Latest: "${openTkts[0].subject}"`, onclick:`openTicketModal(${openTkts[0].id})` });
  }

  /* Upcoming bills (next 7 days) */
  const now = Date.now(), soon = now + 7*86400000;
  const upcoming = (CAL.events||[]).filter(e => e.start_datetime*1000 > now && e.start_datetime*1000 < soon);
  if (upcoming.length) {
    alerts.push({ icon:'📅', title:`${upcoming.length} billing events in the next 7 days`, sub:`Includes: ${[...new Set(upcoming.map(e=>e.attendees?.[0]).filter(Boolean))].slice(0,3).join(', ')}`, onclick:`navigateTo('subscriptions')` });
  }

  /* Accounts with negative balance */
  const negAccts = FT.accounts.filter(a => a.balance < 0);
  if (negAccts.length) {
    alerts.push({ icon:'⚠️', title:`${negAccts.length} accounts with negative balance`, sub:`Total deficit: $${Math.abs(negAccts.reduce((s,a)=>s+a.balance,0)).toLocaleString(undefined,{maximumFractionDigits:0})}`, onclick:`navigateTo('accounts')` });
  }

  /* Users with many subscriptions (>3 active) */
  const subByUser = {};
  FT.subscriptions.filter(s=>s.status==='Active').forEach(s => { subByUser[s.user_id]=(subByUser[s.user_id]||0)+1; });
  const highSub = Object.entries(subByUser).filter(([,c])=>c>3);
  if (highSub.length) {
    const top = highSub.sort((a,b)=>b[1]-a[1])[0];
    const u = FT.users.find(x => x.user_id === top[0]);
    alerts.push({ icon:'🔄', title:`${highSub.length} users with 4+ active subscriptions`, sub:`Top: ${u?.name||top[0]} with ${top[1]} subscriptions`, onclick:`openUserModal('${top[0]}')` });
  }

  /* Cancelled subs still in calendar */
  const cancelledCalEvts = (CAL.events||[]).filter(e => e.description?.includes('Status: Cancelled'));
  if (cancelledCalEvts.length) {
    alerts.push({ icon:'📋', title:`${cancelledCalEvts.length} cancelled subscriptions still in calendar`, sub:'Calendar-subscription sync discrepancy', onclick:`navigateTo('integrity')` });
  }

  if (!alerts.length) alerts.push({ icon:'✅', title:'No critical alerts', sub:'All data looks healthy', onclick:'' });

  document.getElementById('alerts-box').innerHTML = `
    <div class="alerts-title">Critical Alerts & Data Signals</div>
    <div class="alerts-grid">
      ${alerts.map(a => `
        <div class="alert-item" onclick="${a.onclick}">
          <div class="alert-icon">${a.icon}</div>
          <div class="alert-text"><strong>${a.title}</strong><span>${a.sub}</span></div>
        </div>`).join('')}
    </div>`;
}

function renderSpendingChart() {
  const cat = {};
  FT.transactions.forEach(t => { if(t.amount<0) cat[t.category]=(cat[t.category]||0)+Math.abs(t.amount); });
  const e = Object.entries(cat).sort((a,b)=>b[1]-a[1]);
  const colors = PALETTE.map(c=>c+'bb');
  mkChart('c-spending-cat','doughnut',{
    labels: e.map(([k])=>k),
    datasets:[{data:e.map(([,v])=>+v.toFixed(0)),backgroundColor:colors,borderColor:'#0f1829',borderWidth:2}]
  },{plugins:{legend:{display:false}},cutout:'55%',
    tooltip:{callbacks:{label:ctx=>` ${ctx.label}: $${ctx.parsed.toLocaleString()}`}}});

  const legend = document.getElementById('c-spending-cat-legend');
  if (legend) {
    legend.innerHTML = e.map(([k], i) =>
      `<div class="cll-item"><span class="cll-dot" style="background:${colors[i]}"></span><span class="cll-label">${k}</span></div>`
    ).join('');
  }
}

function renderAccountTypesChart() {
  const dist = {};
  FT.accounts.forEach(a => { dist[a.account_type]=(dist[a.account_type]||0)+1; });
  const e = Object.entries(dist).sort((a,b)=>b[1]-a[1]);
  mkChart('c-account-types','doughnut',{
    labels:e.map(([k])=>k),
    datasets:[{data:e.map(([,v])=>v),backgroundColor:PALETTE.map(c=>c+'bb'),borderColor:'#0f1829',borderWidth:2}]
  },{plugins:{legend:{position:'right',labels:{color:'#94a3b8',padding:9,boxWidth:9}}},cutout:'55%'});
}

/* ══════════════════════════════════════
   NETWORK GRAPH
══════════════════════════════════════ */
function renderNetwork() {
  if (!NETWORK) NETWORK = new NetworkGraph('network-svg','tooltip');
  NETWORK.build(FT, ZD, document.getElementById('cb-tickets')?.checked||false);
  ['users','accounts','merchants','services','tickets'].forEach(key => {
    const cb = document.getElementById(`cb-${key}`);
    if (!cb||cb._bound) return; cb._bound=true;
    cb.addEventListener('change', () => {
      const m={users:'user',accounts:'account',merchants:'merchant',services:'service',tickets:'ticket'};
      NETWORK.setTypes(['users','accounts','merchants','services','tickets'].filter(k=>document.getElementById(`cb-${k}`)?.checked).map(k=>m[k]));
    });
  });
  const btn=document.getElementById('btn-reset-zoom');
  if(btn&&!btn._bound){btn._bound=true;btn.addEventListener('click',()=>NETWORK.resetZoom());}
}
