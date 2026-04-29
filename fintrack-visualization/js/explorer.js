/* ═══════════════════════════════════════════════════════════════
   OpenClaw FinTrack Universe — Data Explorer
   Full drill-down access to every record across all 5 services.
   Provides: detail panel, universal tables, global search,
             user 360° view, and scenario builder.
═══════════════════════════════════════════════════════════════ */

const PAGE_SIZE = 50;

/* ─── Explorer state ─── */
const EX = {
  tx:   { page: 0, sort: { col: 'date', dir: 'desc' }, filters: { search:'', cat:'', userId:'', dateFrom:'', dateTo:'', amtMin:'', amtMax:'' } },
  user: { page: 0, sort: { col: 'user_id', dir: 'asc' }, filter: '' },
  acct: { page: 0, filter: '', typeFilter: '', instFilter: '' },
  sub:  { page: 0, filter: '', statusFilter: '', freqFilter: '' },
  sup:  { filter: '' },
};

let _detailRecord   = null;
let _detailType     = null;
let _detailTabState = { fields: true, related: false, raw: false };

/* ══════════════════════════════════════════════════
   DETAIL PANEL
══════════════════════════════════════════════════ */

function openDetail(type, record, title) {
  _detailRecord = record;
  _detailType   = type;

  const panel = document.getElementById('detail-panel');
  document.getElementById('detail-type-badge').textContent = type.toUpperCase();
  document.getElementById('detail-type-badge').className = 'detail-type-badge badge badge-' + type;
  document.getElementById('detail-title').textContent = title || type;

  renderDetailFields(type, record);
  renderDetailRelated(type, record);
  renderDetailRaw(record);

  panel.classList.add('open');
  document.getElementById('layout').classList.add('panel-open');
  switchDetailTab('fields', document.querySelector('.detail-tab[data-dtab="fields"]'));
}

function closeDetail() {
  document.getElementById('detail-panel').classList.remove('open');
  document.getElementById('layout').classList.remove('panel-open');
  _detailRecord = null;
}

function switchDetailTab(tab, btn) {
  document.querySelectorAll('.detail-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const ids = { fields: 'detail-body', related: 'detail-related', raw: 'detail-raw' };
  Object.values(ids).forEach(id => document.getElementById(id).classList.add('hidden'));
  document.getElementById(ids[tab]).classList.remove('hidden');
}

function renderDetailFields(type, r) {
  const body = document.getElementById('detail-body');
  const mask = v => v ? '•••-••-' + String(v).slice(-4) : '—';
  const fmt  = v => v == null ? '<span style="color:var(--text3)">null</span>' : String(v);
  const money= v => v == null ? '—' : `<span class="${v < 0 ? 'amt-neg':'amt-pos'}">$${Math.abs(v).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>`;

  let fields = [];

  if (type === 'user') {
    fields = [
      { k:'User ID',       v: r.user_id },
      { k:'Full Name',     v: r.name },
      { k:'Email',         v: r.email },
      { k:'Phone',         v: r.phone },
      { k:'Member Since',  v: r.member_since },
      { k:'Status',        v: `<span class="badge badge-${r.status?.toLowerCase()}">${r.status}</span>` },
      { k:'Linked Accounts', v: r.linked_accounts_count },
      { k:'Date of Birth', v: r.date_of_birth },
      { k:'SSN',           v: mask(r.ssn), mono: true, cls:'masked' },
      { k:"Mother's Maiden", v: r.mothers_maiden_name },
    ];
  } else if (type === 'account') {
    const owner = FT.users.find(u => u.user_id === r.user_id);
    fields = [
      { k:'Account ID',   v: r.account_id },
      { k:'User',         v: owner ? `<button class="link-btn" onclick="openUserDetail('${r.user_id}')">${owner.name}</button>` : r.user_id },
      { k:'Institution',  v: r.institution_name },
      { k:'Type',         v: r.account_type },
      { k:'Last Four',    v: r.last_four ? `•••• ${r.last_four}` : '—', mono: true },
      { k:'Balance',      v: money(r.balance), raw: true },
      { k:'Status',       v: `<span class="badge badge-${r.status?.toLowerCase()}">${r.status}</span>` },
    ];
  } else if (type === 'tx') {
    const owner = FT.users.find(u => u.user_id === r.user_id);
    fields = [
      { k:'Transaction ID', v: r.transaction_id, mono: true },
      { k:'Date',           v: r.date },
      { k:'User',           v: owner ? `<button class="link-btn" onclick="openUserDetail('${r.user_id}')">${owner.name}</button>` : r.user_id },
      { k:'Merchant',       v: r.merchant },
      { k:'Amount',         v: money(r.amount), raw: true },
      { k:'Category',       v: `<span class="badge badge-cat">${r.category}</span>` },
      { k:'Account (last4)',v: r.account_last_four ? `•••• ${r.account_last_four}` : '—', mono: true },
    ];
  } else if (type === 'sub') {
    const owner = FT.users.find(u => u.user_id === r.user_id);
    fields = [
      { k:'Subscription ID', v: r.subscription_id, mono: true },
      { k:'User',            v: owner ? `<button class="link-btn" onclick="openUserDetail('${r.user_id}')">${owner.name}</button>` : r.user_id },
      { k:'Service',         v: r.service_name },
      { k:'Amount',          v: `$${r.amount?.toFixed(2)}` },
      { k:'Frequency',       v: r.billing_frequency },
      { k:'Next Billing',    v: r.next_billing_date },
      { k:'Status',          v: `<span class="badge badge-${r.status?.toLowerCase()}">${r.status}</span>` },
    ];
  } else if (type === 'ticket') {
    const zdUser = (ZD.users||[]).find(u => u.id === r.requester_id);
    const ftUser = zdUser ? FT.users.find(u => u.user_id === zdUser.external_id) : null;
    fields = [
      { k:'Ticket ID',   v: r.external_id, mono: true },
      { k:'Internal ID', v: r.id },
      { k:'Subject',     v: r.subject },
      { k:'Description', v: r.description },
      { k:'Status',      v: `<span class="badge badge-${r.status}">${r.status}</span>` },
      { k:'Priority',    v: `<span class="badge badge-${r.priority}">${r.priority}</span>` },
      { k:'Type',        v: r.type },
      { k:'Requester',   v: zdUser ? `<button class="link-btn" onclick="${ftUser ? `openUserDetail('${zdUser.external_id}')` : ''}">${zdUser.name}</button>` : r.requester_id },
      { k:'FinTrack ID', v: zdUser?.external_id || '—', mono: true },
      { k:'Channel',     v: r.via_channel },
      { k:'Created',     v: r.created_at?.slice(0,16).replace('T',' ') },
      { k:'Updated',     v: r.updated_at?.slice(0,16).replace('T',' ') },
      { k:'Tags',        v: (r.tags||[]).map(t => `<span class="badge badge-cat">${t}</span>`).join(' ') || '—' },
    ];
  } else if (type === 'email') {
    fields = [
      { k:'Email ID',   v: r.email_id?.slice(0,16) + '…', mono: true },
      { k:'Folder',     v: r.folder },
      { k:'Sender',     v: r.sender },
      { k:'Recipients', v: (r.recipients||[]).join(', ') },
      { k:'Subject',    v: r.subject },
      { k:'Read',       v: r.is_read ? '✓ Read' : '✗ Unread' },
      { k:'Timestamp',  v: r.timestamp ? new Date(r.timestamp*1000).toISOString().slice(0,16).replace('T',' ') : '—' },
      { k:'Content',    v: `<div style="max-height:120px;overflow-y:auto;font-size:11px;color:var(--text2);line-height:1.5;">${(r.content||'').replace(/\n/g,'<br>')}</div>`, raw: true },
    ];
  } else if (type === 'contact') {
    fields = [
      { k:'Contact ID', v: r.contact_id?.slice(0,16) + '…', mono: true },
      { k:'Name',       v: `${r.first_name} ${r.last_name}` },
      { k:'Email',      v: r.email },
      { k:'Phone',      v: r.phone },
      { k:'Status',     v: r.status },
      { k:'Job',        v: r.job || '—' },
      { k:'Country',    v: r.country || '—' },
      { k:'Is Agent',   v: r.is_user ? 'Yes (Agent)' : 'No (Customer)' },
      { k:'Description',v: r.description },
    ];
  }

  const rowsHtml = fields.map(f => `
    <div class="df-row">
      <span class="df-key">${f.k}</span>
      <span class="df-val${f.mono?' mono':''}${f.cls?' '+f.cls:''}">${f.raw ? f.v : escHtml(String(f.v ?? '—')).replace(/&amp;lt;/g,'<').replace(/&amp;gt;/g,'>').replace(/&amp;quot;/g,'"')}</span>
    </div>`).join('');

  /* Fix: for raw HTML fields, we need to inject them unescaped */
  body.innerHTML = `<div class="detail-fields">${fields.map(f => `
    <div class="df-row">
      <span class="df-key">${f.k}</span>
      <span class="df-val${f.mono?' mono':''}${f.cls?' '+f.cls:''}">${f.raw !== false && (f.v?.includes?.('<') || f.v?.includes?.('onclick')) ? f.v : escHtml(String(f.v ?? '—'))}</span>
    </div>`).join('')}</div>`;
}

function renderDetailRelated(type, r) {
  const el = document.getElementById('detail-related');
  let html = '';

  if (type === 'user') {
    const accts  = FT.accounts.filter(a => a.user_id === r.user_id);
    const txns   = FT.transactions.filter(t => t.user_id === r.user_id).slice(0,10);
    const subs   = FT.subscriptions.filter(s => s.user_id === r.user_id && s.status === 'Active');
    const zdUser = (ZD.users||[]).find(u => u.external_id === r.user_id);
    const tickets= zdUser ? (ZD.tickets||[]).filter(t => t.requester_id === zdUser.id) : [];
    const contact= (CT.contacts||[]).find(c => c.email === r.email);
    const calEvts= (CAL.events||[]).filter(e => (e.attendees||[]).includes(r.name)).slice(0,5);

    html += relatedSection('🏦 Accounts', accts.map(a =>
      `<div class="related-item" onclick="openDetail('account', ${safeJson(a)}, '${esc(a.institution_name)} ${esc(a.account_type)}')">
        <span class="related-item-icon">🏦</span>
        <div><div class="related-item-main">${esc(a.institution_name)} — ${esc(a.account_type)}</div>
        <div class="related-item-sub">•••• ${a.last_four} | Balance: <span class="${a.balance<0?'amt-neg':'amt-pos'}">$${Math.abs(a.balance).toLocaleString()}</span></div></div></div>`).join('')
    );

    html += relatedSection('💳 Recent Transactions', `
      <table class="related-mini-table">
        <thead><tr><th>Date</th><th>Merchant</th><th>Amount</th><th>Category</th></tr></thead>
        <tbody>${txns.map(t =>
          `<tr class="link-row" onclick="openDetail('tx', ${safeJson(t)}, '${esc(t.merchant)}')">
            <td>${t.date}</td><td>${esc(t.merchant)}</td>
            <td class="${t.amount<0?'amt-neg':'amt-pos'}">$${Math.abs(t.amount).toFixed(2)}</td>
            <td><span class="badge badge-cat">${esc(t.category)}</span></td>
          </tr>`).join('')}
        </tbody>
      </table>
      <button class="btn-ghost" style="margin-top:8px;font-size:10px" onclick="filterTxByUser('${r.user_id}')">View all transactions →</button>
    `);

    if (subs.length) html += relatedSection('🔄 Active Subscriptions', subs.map(s =>
      `<div class="related-item" onclick="openDetail('sub', ${safeJson(s)}, '${esc(s.service_name)}')">
        <span class="related-item-icon">🔄</span>
        <div><div class="related-item-main">${esc(s.service_name)}</div>
        <div class="related-item-sub">$${s.amount} / ${s.billing_frequency} · Next: ${s.next_billing_date}</div></div></div>`).join('')
    );

    if (tickets.length) html += relatedSection('🎫 Support Tickets', tickets.map(t =>
      `<div class="related-item" onclick="openDetail('ticket', ${safeJson(t)}, '${esc(t.subject?.slice(0,40))}')">
        <span class="related-item-icon">🎫</span>
        <div><div class="related-item-main">${esc(t.subject)}</div>
        <div class="related-item-sub">${t.external_id} · ${t.created_at?.slice(0,10)}</div></div></div>`).join('')
    );

    if (contact) html += relatedSection('📇 Contact Record', `
      <div class="related-item" onclick="openDetail('contact', ${safeJson(contact)}, '${esc(contact.first_name+' '+contact.last_name)}')">
        <span class="related-item-icon">📇</span>
        <div><div class="related-item-main">${esc(contact.first_name)} ${esc(contact.last_name)}</div>
        <div class="related-item-sub">${esc(contact.description||'')}</div></div></div>`);

    if (calEvts.length) html += relatedSection('📅 Upcoming Billing Events', calEvts.map(e => {
      const d = new Date(e.start_datetime * 1000).toLocaleDateString();
      return `<div class="related-item"><span class="related-item-icon">📅</span>
        <div><div class="related-item-main">${esc(e.title)}</div>
        <div class="related-item-sub">${d}</div></div></div>`;
    }).join(''));

  } else if (type === 'account') {
    const txns = FT.transactions.filter(t =>
      t.user_id === r.user_id && t.account_last_four === r.last_four
    ).slice(0,12);
    const owner = FT.users.find(u => u.user_id === r.user_id);

    if (owner) html += relatedSection('👤 Account Owner', `
      <div class="related-item" onclick="openUserDetail('${r.user_id}')">
        <span class="related-item-icon">👤</span>
        <div><div class="related-item-main">${esc(owner.name)}</div>
        <div class="related-item-sub">${esc(owner.email)} · Member since ${owner.member_since}</div></div></div>`);

    html += relatedSection('💳 Transactions on this Account', `
      <table class="related-mini-table">
        <thead><tr><th>Date</th><th>Merchant</th><th>Amount</th><th>Cat.</th></tr></thead>
        <tbody>${txns.map(t =>
          `<tr class="link-row" onclick="openDetail('tx', ${safeJson(t)}, '${esc(t.merchant)}')">
            <td>${t.date}</td><td>${esc(t.merchant)}</td>
            <td class="${t.amount<0?'amt-neg':'amt-pos'}">$${Math.abs(t.amount).toFixed(2)}</td>
            <td>${esc(t.category)}</td></tr>`).join('')}
        </tbody>
      </table>`);

  } else if (type === 'tx') {
    const owner = FT.users.find(u => u.user_id === r.user_id);
    const acct  = FT.accounts.find(a => a.user_id === r.user_id && a.last_four === r.account_last_four);
    const sameMerchant = FT.transactions.filter(t => t.merchant === r.merchant && t.transaction_id !== r.transaction_id).slice(0,8);

    if (owner) html += relatedSection('👤 User', `
      <div class="related-item" onclick="openUserDetail('${r.user_id}')">
        <span class="related-item-icon">👤</span>
        <div><div class="related-item-main">${esc(owner.name)}</div>
        <div class="related-item-sub">${esc(owner.email)}</div></div></div>`);

    if (acct) html += relatedSection('🏦 Account', `
      <div class="related-item" onclick="openDetail('account', ${safeJson(acct)}, '${esc(acct.institution_name)}')">
        <span class="related-item-icon">🏦</span>
        <div><div class="related-item-main">${esc(acct.institution_name)} — ${esc(acct.account_type)}</div>
        <div class="related-item-sub">•••• ${acct.last_four}</div></div></div>`);

    html += relatedSection(`🏪 Other transactions at ${r.merchant}`, `
      <table class="related-mini-table">
        <thead><tr><th>Date</th><th>User</th><th>Amount</th></tr></thead>
        <tbody>${sameMerchant.map(t => {
          const u = FT.users.find(x => x.user_id === t.user_id);
          return `<tr class="link-row" onclick="openDetail('tx', ${safeJson(t)}, '${esc(t.merchant)}')">
            <td>${t.date}</td><td>${esc(u?.name||t.user_id)}</td>
            <td class="${t.amount<0?'amt-neg':'amt-pos'}">$${Math.abs(t.amount).toFixed(2)}</td></tr>`;
        }).join('')}
        </tbody>
      </table>`);

  } else if (type === 'ticket') {
    const zdUser = (ZD.users||[]).find(u => u.id === r.requester_id);
    const ftUser = zdUser ? FT.users.find(u => u.user_id === zdUser.external_id) : null;
    const email  = (EM.emails||[]).find(e => e.sender === zdUser?.email);

    if (ftUser) html += relatedSection('👤 FinTrack User Profile', `
      <div class="related-item" onclick="openUserDetail('${ftUser.user_id}')">
        <span class="related-item-icon">👤</span>
        <div><div class="related-item-main">${esc(ftUser.name)} (${ftUser.user_id})</div>
        <div class="related-item-sub">${esc(ftUser.email)} · Member since ${ftUser.member_since}</div></div></div>
      <button class="btn-ghost" style="margin-top:8px;font-size:10px" onclick="buildScenarioFor('${ftUser.user_id}')">Build full OpenClaw context →</button>`);

    if (ftUser) {
      const accts = FT.accounts.filter(a => a.user_id === ftUser.user_id);
      const bal = accts.reduce((s,a) => s+a.balance, 0);
      html += relatedSection('🏦 User Accounts', `
        <div style="font-size:11px;color:var(--text2);margin-bottom:6px">${accts.length} accounts · Total balance: <span class="${bal<0?'amt-neg':'amt-pos'}">$${Math.abs(bal).toLocaleString()}</span></div>
        <table class="related-mini-table">
          <thead><tr><th>Institution</th><th>Type</th><th>Balance</th></tr></thead>
          <tbody>${accts.map(a =>
            `<tr onclick="openDetail('account', ${safeJson(a)}, '${esc(a.institution_name)}')" class="link-row">
              <td>${esc(a.institution_name)}</td><td>${esc(a.account_type)}</td>
              <td class="${a.balance<0?'amt-neg':'amt-pos'}">$${Math.abs(a.balance).toLocaleString()}</td>
            </tr>`).join('')}
          </tbody>
        </table>`);
    }

    if (email) html += relatedSection('📧 Linked Email', `
      <div class="related-item" onclick="openDetail('email', ${safeJson(email)}, '${esc(email.subject)}')">
        <span class="related-item-icon">📧</span>
        <div><div class="related-item-main">${esc(email.subject)}</div>
        <div class="related-item-sub">From: ${esc(email.sender)}</div></div></div>`);
  }

  el.innerHTML = html || '<div class="empty-state"><div class="es-icon">🔗</div><p>No related records found.</p></div>';
}

function renderDetailRaw(record) {
  document.getElementById('detail-raw').innerHTML =
    `<pre class="raw-json">${escHtml(JSON.stringify(record, null, 2))}</pre>`;
}

function relatedSection(title, content) {
  return `<div class="related-section"><div class="related-section-title">${title}</div>${content}</div>`;
}

/* ── Utility: open user 360 detail ── */
function openUserDetail(userId) {
  const user = FT.users.find(u => u.user_id === userId);
  if (!user) return;
  openDetail('user', user, user.name);
}

/* ── Utility: filter transactions by user ── */
function filterTxByUser(userId) {
  const user = FT.users.find(u => u.user_id === userId);
  EX.tx.filters.userId = userId;
  EX.tx.page = 0;
  closeDetail();
  navigateTo('transactions');
  setTimeout(() => {
    const sel = document.getElementById('tx-user-filter');
    if (sel) sel.value = userId;
    renderTransactionsTable();
  }, 100);
}

/* ── Utility: go to scenario builder for a user ── */
function buildScenarioFor(userId) {
  closeDetail();
  navigateTo('scenarios');
  setTimeout(() => {
    const sel = document.getElementById('scenario-user-select');
    if (sel) { sel.value = userId; }
    const btn = document.getElementById('scenario-build-btn');
    if (btn) { btn.disabled = false; buildScenario(userId); }
  }, 100);
}

/* ══════════════════════════════════════════════════
   GLOBAL SEARCH
══════════════════════════════════════════════════ */
let _searchTimer = null;

function initGlobalSearch() {
  const input = document.getElementById('global-search');
  const results = document.getElementById('search-results');
  if (!input) return;

  input.addEventListener('input', () => {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => runGlobalSearch(input.value.trim()), 250);
  });
  input.addEventListener('blur', () => {
    setTimeout(() => results.classList.add('hidden'), 200);
  });
  input.addEventListener('focus', () => {
    if (input.value.trim().length >= 2) results.classList.remove('hidden');
  });
}

function runGlobalSearch(q) {
  const results = document.getElementById('search-results');
  if (q.length < 2) { results.classList.add('hidden'); return; }
  const ql = q.toLowerCase();

  const userHits = FT.users.filter(u =>
    u.name.toLowerCase().includes(ql) || u.email.toLowerCase().includes(ql) || u.user_id.toLowerCase().includes(ql)
  ).slice(0,5);

  const txHits = FT.transactions.filter(t =>
    t.merchant.toLowerCase().includes(ql) || t.category.toLowerCase().includes(ql) || t.transaction_id.toLowerCase().includes(ql)
  ).slice(0,5);

  const acctHits = FT.accounts.filter(a =>
    a.institution_name.toLowerCase().includes(ql) || a.account_type.toLowerCase().includes(ql) || a.last_four?.includes(ql)
  ).slice(0,4);

  const ticketHits = (ZD.tickets||[]).filter(t =>
    t.subject?.toLowerCase().includes(ql) || t.description?.toLowerCase().includes(ql) || t.external_id?.toLowerCase().includes(ql)
  ).slice(0,4);

  const subHits = FT.subscriptions.filter(s =>
    s.service_name.toLowerCase().includes(ql)
  ).slice(0,4);

  if (!userHits.length && !txHits.length && !acctHits.length && !ticketHits.length && !subHits.length) {
    results.innerHTML = `<div class="search-empty">No results for "${escHtml(q)}"</div>`;
    results.classList.remove('hidden');
    return;
  }

  let html = '';
  if (userHits.length) {
    html += `<div class="search-group-title">👤 Users</div>`;
    html += userHits.map(u => `
      <div class="search-result-item" onclick="openUserDetail('${u.user_id}');document.getElementById('search-results').classList.add('hidden')">
        <span class="sri-icon">👤</span>
        <div><div class="sri-main">${hilite(u.name,q)}</div><div class="sri-sub">${hilite(u.email,q)} · ${u.user_id}</div></div>
      </div>`).join('');
  }
  if (txHits.length) {
    html += `<div class="search-group-title">💳 Transactions</div>`;
    html += txHits.map(t => {
      const u = FT.users.find(x => x.user_id === t.user_id);
      return `<div class="search-result-item" onclick="openDetail('tx',${safeJson(t)},'${esc(t.merchant)}');document.getElementById('search-results').classList.add('hidden')">
        <span class="sri-icon">💳</span>
        <div><div class="sri-main">${hilite(t.merchant,q)}</div>
        <div class="sri-sub">${t.date} · ${u?.name||t.user_id} · <span class="${t.amount<0?'amt-neg':'amt-pos'}">$${Math.abs(t.amount).toFixed(2)}</span></div></div>
      </div>`;
    }).join('');
  }
  if (acctHits.length) {
    html += `<div class="search-group-title">🏦 Accounts</div>`;
    html += acctHits.map(a => {
      const u = FT.users.find(x => x.user_id === a.user_id);
      return `<div class="search-result-item" onclick="openDetail('account',${safeJson(a)},'${esc(a.institution_name)}');document.getElementById('search-results').classList.add('hidden')">
        <span class="sri-icon">🏦</span>
        <div><div class="sri-main">${hilite(a.institution_name,q)} — ${a.account_type}</div>
        <div class="sri-sub">•••• ${a.last_four} · Owner: ${u?.name||a.user_id}</div></div>
      </div>`;
    }).join('');
  }
  if (ticketHits.length) {
    html += `<div class="search-group-title">🎫 Support Tickets</div>`;
    html += ticketHits.map(t => `
      <div class="search-result-item" onclick="openDetail('ticket',${safeJson(t)},'${esc(t.subject?.slice(0,40))}');document.getElementById('search-results').classList.add('hidden')">
        <span class="sri-icon">🎫</span>
        <div><div class="sri-main">${hilite(t.subject||'',q)}</div>
        <div class="sri-sub">${t.external_id} · ${t.created_at?.slice(0,10)}</div></div>
      </div>`).join('');
  }
  if (subHits.length) {
    html += `<div class="search-group-title">🔄 Subscriptions</div>`;
    html += subHits.map(s => {
      const u = FT.users.find(x => x.user_id === s.user_id);
      return `<div class="search-result-item" onclick="openDetail('sub',${safeJson(s)},'${esc(s.service_name)}');document.getElementById('search-results').classList.add('hidden')">
        <span class="sri-icon">🔄</span>
        <div><div class="sri-main">${hilite(s.service_name,q)}</div>
        <div class="sri-sub">${u?.name||s.user_id} · $${s.amount}/${s.billing_frequency}</div></div>
      </div>`;
    }).join('');
  }

  results.innerHTML = html;
  results.classList.remove('hidden');
}

/* ══════════════════════════════════════════════════
   USERS EXPLORER
══════════════════════════════════════════════════ */
function renderUsersPage() {
  populateUsersFilters();
  bindUsersEvents();
  renderUsersTable();
}

function populateUsersFilters() { /* filters are text-only */ }

function bindUsersEvents() {
  const search = document.getElementById('users-search');
  const sortEl = document.getElementById('users-sort');
  if (search) { search.oninput = debounce(() => { EX.user.page=0; renderUsersTable(); }, 200); }
  if (sortEl) { sortEl.onchange = () => { EX.user.page=0; EX.user.sort.col=sortEl.value; renderUsersTable(); }; }
}

function renderUsersTable() {
  const q = (document.getElementById('users-search')?.value||'').toLowerCase();
  let rows = FT.users.filter(u =>
    !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.user_id.toLowerCase().includes(q)
  );

  const col = EX.user.sort.col;
  rows.sort((a,b) => {
    const av = a[col]||'', bv = b[col]||'';
    return typeof av === 'number' ? av-bv : String(av).localeCompare(String(bv));
  });

  document.getElementById('users-count').textContent = `${rows.length} users`;

  const page = EX.user.page;
  const slice = rows.slice(page*PAGE_SIZE, (page+1)*PAGE_SIZE);
  const cols = [
    { key:'user_id', label:'ID', w:'70px' },
    { key:'name',    label:'Name' },
    { key:'email',   label:'Email' },
    { key:'member_since', label:'Member Since', w:'120px' },
    { key:'linked_accounts_count', label:'Accounts', w:'80px' },
    { key:'status',  label:'Status', w:'80px' },
  ];

  const html = `<table class="data-table">
    <thead><tr>${cols.map(c => `<th style="${c.w?'width:'+c.w:''}">${c.label}</th>`).join('')}</tr></thead>
    <tbody>${slice.map(u => `
      <tr class="clickable" onclick="openDetail('user', ${safeJson(u)}, '${esc(u.name)}')">
        <td class="mono">${esc(u.user_id)}</td>
        <td><strong>${esc(u.name)}</strong></td>
        <td style="color:var(--text2)">${esc(u.email)}</td>
        <td>${u.member_since}</td>
        <td>${u.linked_accounts_count}</td>
        <td><span class="badge badge-active">${u.status}</span></td>
      </tr>`).join('')}
    </tbody>
  </table>`;

  document.getElementById('users-table').innerHTML = html;
  renderPagination('users-pagination', page, rows.length, p => { EX.user.page=p; renderUsersTable(); });
}

/* ══════════════════════════════════════════════════
   ACCOUNTS EXPLORER
══════════════════════════════════════════════════ */
function renderAccountsPage() {
  const types = [...new Set(FT.accounts.map(a => a.account_type))].sort();
  const insts = [...new Set(FT.accounts.map(a => a.institution_name))].sort();
  const typeEl = document.getElementById('accounts-type-filter');
  const instEl = document.getElementById('accounts-inst-filter');
  if (typeEl && !typeEl.children.length > 1) {
    types.forEach(t => { const o=document.createElement('option'); o.value=t; o.textContent=t; typeEl.appendChild(o); });
    insts.forEach(i => { const o=document.createElement('option'); o.value=i; o.textContent=i; instEl.appendChild(o); });
    const bind = () => { EX.acct.page=0; renderAccountsTable(); };
    document.getElementById('accounts-search').oninput = debounce(bind,200);
    typeEl.onchange = bind;
    instEl.onchange = bind;
  }
  renderAccountsTable();
}

function renderAccountsTable() {
  const q    = (document.getElementById('accounts-search')?.value||'').toLowerCase();
  const type = document.getElementById('accounts-type-filter')?.value||'';
  const inst = document.getElementById('accounts-inst-filter')?.value||'';

  let rows = FT.accounts.filter(a =>
    (!q    || a.institution_name.toLowerCase().includes(q) || a.account_type.toLowerCase().includes(q) || a.last_four?.includes(q) || a.user_id.toLowerCase().includes(q)) &&
    (!type || a.account_type === type) &&
    (!inst || a.institution_name === inst)
  );

  document.getElementById('accounts-count').textContent = `${rows.length} accounts`;

  const page = EX.acct.page;
  const slice = rows.slice(page*PAGE_SIZE, (page+1)*PAGE_SIZE);

  const html = `<table class="data-table">
    <thead><tr>
      <th style="width:80px">Acct ID</th><th>Institution</th><th>Type</th>
      <th style="width:90px">Last Four</th><th style="width:120px">Balance</th>
      <th style="width:80px">Status</th><th>Owner</th>
    </tr></thead>
    <tbody>${slice.map(a => {
      const owner = FT.users.find(u => u.user_id === a.user_id);
      return `<tr class="clickable" onclick="openDetail('account', ${safeJson(a)}, '${esc(a.institution_name)} ${esc(a.account_type)}')">
        <td class="mono" style="font-size:11px">${esc(a.account_id)}</td>
        <td><strong>${esc(a.institution_name)}</strong></td>
        <td>${esc(a.account_type)}</td>
        <td class="mono">•••• ${a.last_four}</td>
        <td class="${a.balance<0?'amt-neg':'amt-pos'}">$${Math.abs(a.balance).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
        <td><span class="badge badge-active">${a.status}</span></td>
        <td><button class="link-btn" onclick="event.stopPropagation();openUserDetail('${a.user_id}')">${esc(owner?.name||a.user_id)}</button></td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>`;

  document.getElementById('accounts-table').innerHTML = html;
  renderPagination('accounts-pagination', page, rows.length, p => { EX.acct.page=p; renderAccountsTable(); });
}

/* ══════════════════════════════════════════════════
   TRANSACTIONS EXPLORER
══════════════════════════════════════════════════ */
function renderTransactionsPage() {
  /* Populate category dropdown */
  const catEl  = document.getElementById('tx-cat-filter');
  const userEl = document.getElementById('tx-user-filter');
  if (catEl && catEl.children.length <= 1) {
    const cats = [...new Set(FT.transactions.map(t => t.category))].sort();
    cats.forEach(c => { const o=document.createElement('option'); o.value=c; o.textContent=c; catEl.appendChild(o); });
    FT.users.slice(0,80).forEach(u => { const o=document.createElement('option'); o.value=u.user_id; o.textContent=u.name; userEl.appendChild(o); });

    const bind = debounce(() => { EX.tx.page=0; readTxFilters(); renderTransactionsTable(); }, 200);
    ['tx-search','tx-cat-filter','tx-user-filter','tx-date-from','tx-date-to','tx-amt-min','tx-amt-max']
      .forEach(id => { const el=document.getElementById(id); if(el){ el.oninput=bind; el.onchange=bind; } });
    document.getElementById('tx-clear').onclick = () => {
      ['tx-search','tx-date-from','tx-date-to','tx-amt-min','tx-amt-max'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
      catEl.value=''; userEl.value='';
      EX.tx.filters = { search:'', cat:'', userId:'', dateFrom:'', dateTo:'', amtMin:'', amtMax:'' };
      EX.tx.page=0; renderTransactionsTable();
    };
  }
  /* Restore any pre-set filters (e.g. from filterTxByUser) */
  if (EX.tx.filters.userId) {
    const sel = document.getElementById('tx-user-filter');
    if (sel) sel.value = EX.tx.filters.userId;
  }
  renderTransactionsTable();
}

function readTxFilters() {
  EX.tx.filters = {
    search:   (document.getElementById('tx-search')?.value||'').toLowerCase(),
    cat:       document.getElementById('tx-cat-filter')?.value||'',
    userId:    document.getElementById('tx-user-filter')?.value||'',
    dateFrom:  document.getElementById('tx-date-from')?.value||'',
    dateTo:    document.getElementById('tx-date-to')?.value||'',
    amtMin:    document.getElementById('tx-amt-min')?.value||'',
    amtMax:    document.getElementById('tx-amt-max')?.value||'',
  };
}

function renderTransactionsTable() {
  readTxFilters();
  const f = EX.tx.filters;

  let rows = FT.transactions.filter(t => {
    if (f.search  && !t.merchant.toLowerCase().includes(f.search)) return false;
    if (f.cat     && t.category !== f.cat)    return false;
    if (f.userId  && t.user_id  !== f.userId) return false;
    if (f.dateFrom && t.date < f.dateFrom)    return false;
    if (f.dateTo   && t.date > f.dateTo)      return false;
    const amt = Math.abs(t.amount);
    if (f.amtMin && amt < parseFloat(f.amtMin)) return false;
    if (f.amtMax && amt > parseFloat(f.amtMax)) return false;
    return true;
  });

  /* Sort */
  const { col, dir } = EX.tx.sort;
  rows.sort((a,b) => {
    let av = a[col], bv = b[col];
    if (col === 'amount') { av = Math.abs(av); bv = Math.abs(bv); }
    const cmp = typeof av === 'number' ? av-bv : String(av||'').localeCompare(String(bv||''));
    return dir === 'asc' ? cmp : -cmp;
  });

  const total = rows.length;
  document.getElementById('tx-count').textContent = `${total.toLocaleString()} transactions`;

  const page = EX.tx.page;
  const slice = rows.slice(page*PAGE_SIZE, (page+1)*PAGE_SIZE);
  const sortable = (lbl, col_) =>
    `<th style="cursor:pointer" class="${EX.tx.sort.col===col_?'sorted-'+EX.tx.sort.dir:''}" onclick="txSort('${col_}')">${lbl}</th>`;

  const html = `<table class="data-table">
    <thead><tr>
      ${sortable('Date','date')}
      <th>User</th>
      ${sortable('Merchant','merchant')}
      ${sortable('Amount','amount')}
      <th>Category</th>
      <th style="width:100px">Account</th>
      <th style="width:70px" class="no-sort">ID</th>
    </tr></thead>
    <tbody>${slice.map(t => {
      const owner = FT.users.find(u => u.user_id === t.user_id);
      return `<tr class="clickable" onclick="openDetail('tx', ${safeJson(t)}, '${esc(t.merchant)}')">
        <td>${t.date}</td>
        <td><button class="link-btn" onclick="event.stopPropagation();openUserDetail('${t.user_id}')">${esc(owner?.name||t.user_id)}</button></td>
        <td><strong>${esc(t.merchant)}</strong></td>
        <td class="${t.amount<0?'amt-neg':'amt-pos'}">$${Math.abs(t.amount).toFixed(2)}</td>
        <td><span class="badge badge-cat">${esc(t.category)}</span></td>
        <td class="mono" style="font-size:11px">•••• ${t.account_last_four||'—'}</td>
        <td class="mono" style="font-size:10px;color:var(--text3)">${t.transaction_id}</td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>`;

  document.getElementById('tx-table').innerHTML = html;
  renderPagination('tx-pagination', page, total, p => { EX.tx.page=p; renderTransactionsTable(); });
}

function txSort(col) {
  if (EX.tx.sort.col === col) { EX.tx.sort.dir = EX.tx.sort.dir==='asc'?'desc':'asc'; }
  else { EX.tx.sort.col = col; EX.tx.sort.dir = 'desc'; }
  EX.tx.page = 0;
  renderTransactionsTable();
}

/* ══════════════════════════════════════════════════
   SUBSCRIPTIONS EXPLORER
══════════════════════════════════════════════════ */
function renderSubscriptionsPage() {
  renderSubCharts();
  renderBillingTimeline();
  renderSubscriptionsTable();
  bindSubEvents();
}

function bindSubEvents() {
  const freqEl = document.getElementById('sub-freq-filter');
  if (freqEl && freqEl.children.length <= 1) {
    const freqs = [...new Set(FT.subscriptions.map(s => s.billing_frequency))].sort();
    freqs.forEach(f => { const o=document.createElement('option'); o.value=f; o.textContent=f; freqEl.appendChild(o); });
    const bind = debounce(() => { EX.sub.page=0; renderSubscriptionsTable(); }, 200);
    ['sub-search','sub-status-filter','sub-freq-filter'].forEach(id => {
      const el = document.getElementById(id); if(el){ el.oninput=bind; el.onchange=bind; }
    });
  }
}

function renderSubscriptionsTable() {
  const q      = (document.getElementById('sub-search')?.value||'').toLowerCase();
  const status = document.getElementById('sub-status-filter')?.value||'';
  const freq   = document.getElementById('sub-freq-filter')?.value||'';

  let rows = FT.subscriptions.filter(s =>
    (!q      || s.service_name.toLowerCase().includes(q) || s.user_id.toLowerCase().includes(q)) &&
    (!status || s.status === status) &&
    (!freq   || s.billing_frequency === freq)
  );

  document.getElementById('sub-count').textContent = `${rows.length} subscriptions`;

  const page = EX.sub.page;
  const slice = rows.slice(page*PAGE_SIZE, (page+1)*PAGE_SIZE);

  const html = `<table class="data-table">
    <thead><tr>
      <th style="width:80px">Sub ID</th><th>User</th><th>Service</th>
      <th style="width:90px">Amount</th><th style="width:110px">Frequency</th>
      <th style="width:120px">Next Billing</th><th style="width:90px">Status</th>
    </tr></thead>
    <tbody>${slice.map(s => {
      const owner = FT.users.find(u => u.user_id === s.user_id);
      return `<tr class="clickable" onclick="openDetail('sub', ${safeJson(s)}, '${esc(s.service_name)}')">
        <td class="mono" style="font-size:11px">${esc(s.subscription_id)}</td>
        <td><button class="link-btn" onclick="event.stopPropagation();openUserDetail('${s.user_id}')">${esc(owner?.name||s.user_id)}</button></td>
        <td><strong>${esc(s.service_name)}</strong></td>
        <td>$${s.amount?.toFixed(2)}</td>
        <td><span class="badge badge-cat">${s.billing_frequency}</span></td>
        <td>${s.next_billing_date}</td>
        <td><span class="badge badge-${s.status?.toLowerCase()}">${s.status}</span></td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>`;

  document.getElementById('sub-table').innerHTML = html;
  renderPagination('sub-pagination', page, rows.length, p => { EX.sub.page=p; renderSubscriptionsTable(); });
}

/* ══════════════════════════════════════════════════
   SUPPORT EXPLORER
══════════════════════════════════════════════════ */
function renderSupportPage() {
  renderSupportCharts();
  bindSupportEvents();
  renderSupportTable();
}

function bindSupportEvents() {
  const el = document.getElementById('support-search');
  if (el && !el._bound) {
    el._bound = true;
    el.oninput = debounce(() => renderSupportTable(), 200);
  }
}

function renderSupportTable() {
  const q = (document.getElementById('support-search')?.value||'').toLowerCase();

  const tickets = (ZD.tickets||[]).filter(t =>
    !q || t.subject?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || t.external_id?.toLowerCase().includes(q)
  );
  const emails = (EM.emails||[]).filter(e =>
    !q || e.subject?.toLowerCase().includes(q) || e.sender?.toLowerCase().includes(q)
  );

  document.getElementById('support-count').textContent = `${tickets.length} tickets · ${emails.length} emails`;

  const zdUserMap = {};
  (ZD.users||[]).forEach(u => { zdUserMap[u.id] = u; });

  const html = `<table class="data-table">
    <thead><tr>
      <th style="width:90px">Ticket ID</th>
      <th>Subject</th>
      <th style="width:160px">Requester</th>
      <th style="width:90px">FinTrack ID</th>
      <th style="width:80px">Status</th>
      <th style="width:80px">Priority</th>
      <th style="width:110px">Created</th>
      <th style="width:70px" class="no-sort">Email</th>
    </tr></thead>
    <tbody>${tickets.map(t => {
      const zd = zdUserMap[t.requester_id];
      const extId = zd?.external_id||'—';
      const ftUser = FT.users.find(u => u.user_id === extId);
      const linkedEmail = (EM.emails||[]).find(e => e.sender === zd?.email);
      return `<tr class="clickable" onclick="openDetail('ticket', ${safeJson(t)}, '${esc(t.subject?.slice(0,40))}')">
        <td class="mono">${t.external_id||'TKT'+t.id}</td>
        <td>${esc(t.subject||'').slice(0,65)}${(t.subject||'').length>65?'…':''}</td>
        <td><button class="link-btn" onclick="event.stopPropagation();${ftUser?`openUserDetail('${extId}')`:''}">${esc(zd?.name||'—')}</button></td>
        <td class="mono" style="font-size:11px">${extId}</td>
        <td><span class="badge badge-open">${t.status}</span></td>
        <td><span class="badge badge-normal">${t.priority||'normal'}</span></td>
        <td style="font-size:11px">${(t.created_at||'').slice(0,16).replace('T',' ')}</td>
        <td>${linkedEmail ? `<button class="link-btn" onclick="event.stopPropagation();openDetail('email',${safeJson(linkedEmail)},'${esc(linkedEmail.subject)}')">📧</button>` : '—'}</td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>`;

  document.getElementById('support-table').innerHTML = html;
}

/* ══════════════════════════════════════════════════
   SCENARIO BUILDER
══════════════════════════════════════════════════ */
function initScenarioBuilder() {
  const sel = document.getElementById('scenario-user-select');
  const btn = document.getElementById('scenario-build-btn');
  if (!sel || sel.children.length > 1) return;
  FT.users.forEach(u => {
    const o = document.createElement('option'); o.value = u.user_id;
    o.textContent = `${u.user_id} — ${u.name}`; sel.appendChild(o);
  });
  sel.onchange = () => { btn.disabled = !sel.value; };
  btn.onclick = () => { if (sel.value) buildScenario(sel.value); };
}

function buildScenario(userId) {
  const user = FT.users.find(u => u.user_id === userId);
  if (!user) return;

  const accts   = FT.accounts.filter(a => a.user_id === userId);
  const txns    = FT.transactions.filter(t => t.user_id === userId);
  const subs    = FT.subscriptions.filter(s => s.user_id === userId);
  const zdUser  = (ZD.users||[]).find(u => u.external_id === userId);
  const tickets = zdUser ? (ZD.tickets||[]).filter(t => t.requester_id === zdUser.id) : [];
  const emails  = (EM.emails||[]).filter(e => e.sender === user.email);
  const contact = (CT.contacts||[]).find(c => c.email === user.email);
  const calEvts = (CAL.events||[]).filter(e => (e.attendees||[]).includes(user.name));

  const totalBal   = accts.reduce((s,a) => s+a.balance, 0);
  const totalSpend = txns.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
  const activeSubs = subs.filter(s => s.status === 'Active');
  const monthlySubCost = activeSubs.reduce((s,sub) => {
    const f = {Monthly:1,Annual:1/12,Weekly:4.33,'Bi-weekly':2.165}[sub.billing_frequency]||1;
    return s + sub.amount * f;
  }, 0);

  const catMap = {};
  txns.filter(t=>t.amount<0).forEach(t => { catMap[t.category] = (catMap[t.category]||0) + Math.abs(t.amount); });
  const topCats = Object.entries(catMap).sort((a,b)=>b[1]-a[1]).slice(0,5);

  const upcomingBills = calEvts
    .filter(e => e.start_datetime * 1000 > Date.now())
    .sort((a,b) => a.start_datetime - b.start_datetime)
    .slice(0,5);

  const recentTxns = [...txns].sort((a,b) => b.date.localeCompare(a.date)).slice(0,8);

  const out = document.getElementById('scenario-output');
  out.innerHTML = `<div class="scenario-out">

    <!-- Identity -->
    <div class="scenario-block">
      <div class="scenario-block-title"><span class="sb-icon">👤</span> Identity — ${esc(user.name)} (${user.user_id})</div>
      <div class="scenario-kpi-row">
        <div class="sc-kpi"><div class="sc-kpi-val">${esc(user.user_id)}</div><div class="sc-kpi-lbl">User ID</div></div>
        <div class="sc-kpi"><div class="sc-kpi-val">${esc(user.member_since)}</div><div class="sc-kpi-lbl">Member Since</div></div>
        <div class="sc-kpi"><div class="sc-kpi-val">${accts.length}</div><div class="sc-kpi-lbl">Linked Accounts</div></div>
        <div class="sc-kpi"><div class="sc-kpi-val">${tickets.length}</div><div class="sc-kpi-lbl">Support Tickets</div></div>
      </div>
      <table class="related-mini-table">
        <tr><td style="color:var(--text3);width:140px">Email</td><td>${esc(user.email)}</td></tr>
        <tr><td style="color:var(--text3)">Phone</td><td>${esc(user.phone)}</td></tr>
        <tr><td style="color:var(--text3)">Date of Birth</td><td>${user.date_of_birth}</td></tr>
        <tr><td style="color:var(--text3)">Status</td><td><span class="badge badge-active">${user.status}</span></td></tr>
        ${contact ? `<tr><td style="color:var(--text3)">Contact Record</td><td>${esc(contact.description||'')}</td></tr>` : ''}
      </table>
    </div>

    <!-- Financial Summary -->
    <div class="scenario-block">
      <div class="scenario-block-title"><span class="sb-icon">💰</span> Financial Summary — ${accts.length} accounts across ${[...new Set(accts.map(a=>a.institution_name))].length} institutions</div>
      <div class="scenario-kpi-row">
        <div class="sc-kpi"><div class="sc-kpi-val ${totalBal<0?'amt-neg':'amt-pos'}">$${Math.abs(Math.round(totalBal)).toLocaleString()}</div><div class="sc-kpi-lbl">Net Balance</div></div>
        <div class="sc-kpi"><div class="sc-kpi-val">$${Math.round(totalSpend).toLocaleString()}</div><div class="sc-kpi-lbl">Total Spent</div></div>
        <div class="sc-kpi"><div class="sc-kpi-val">${txns.length}</div><div class="sc-kpi-lbl">Transactions</div></div>
        <div class="sc-kpi"><div class="sc-kpi-val">$${monthlySubCost.toFixed(0)}/mo</div><div class="sc-kpi-lbl">Subscriptions</div></div>
      </div>
      <table class="related-mini-table">
        <thead><tr><th>Institution</th><th>Type</th><th>Last4</th><th>Balance</th></tr></thead>
        <tbody>${accts.map(a => `
          <tr class="link-row" onclick="openDetail('account',${safeJson(a)},'${esc(a.institution_name)}')">
            <td>${esc(a.institution_name)}</td><td>${esc(a.account_type)}</td>
            <td class="mono">•••• ${a.last_four}</td>
            <td class="${a.balance<0?'amt-neg':'amt-pos'}">$${Math.abs(a.balance).toLocaleString(undefined,{minimumFractionDigits:2})}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <!-- Spending Breakdown -->
    <div class="scenario-block">
      <div class="scenario-block-title"><span class="sb-icon">📊</span> Spending Breakdown (top categories)</div>
      <table class="related-mini-table">
        <thead><tr><th>Category</th><th>Total Spent</th><th>% of Total</th></tr></thead>
        <tbody>${topCats.map(([cat,amt]) => `
          <tr>
            <td><span class="badge badge-cat">${esc(cat)}</span></td>
            <td>$${amt.toFixed(2)}</td>
            <td>${totalSpend > 0 ? (amt/totalSpend*100).toFixed(1)+'%' : '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <!-- Recent Transactions -->
    <div class="scenario-block">
      <div class="scenario-block-title"><span class="sb-icon">💳</span> Recent Transactions (${txns.length} total)</div>
      <table class="related-mini-table">
        <thead><tr><th>Date</th><th>Merchant</th><th>Amount</th><th>Category</th><th>Account</th></tr></thead>
        <tbody>${recentTxns.map(t => `
          <tr class="link-row" onclick="openDetail('tx',${safeJson(t)},'${esc(t.merchant)}')">
            <td>${t.date}</td><td>${esc(t.merchant)}</td>
            <td class="${t.amount<0?'amt-neg':'amt-pos'}">$${Math.abs(t.amount).toFixed(2)}</td>
            <td><span class="badge badge-cat">${esc(t.category)}</span></td>
            <td class="mono">•••• ${t.account_last_four||'—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <button class="btn-ghost" style="margin-top:8px;font-size:10px" onclick="filterTxByUser('${userId}')">View all ${txns.length} transactions →</button>
    </div>

    <!-- Active Subscriptions -->
    <div class="scenario-block">
      <div class="scenario-block-title"><span class="sb-icon">🔄</span> Active Subscriptions (${activeSubs.length})</div>
      ${activeSubs.length ? `<table class="related-mini-table">
        <thead><tr><th>Service</th><th>Amount</th><th>Frequency</th><th>Next Billing</th></tr></thead>
        <tbody>${activeSubs.map(s => `
          <tr class="link-row" onclick="openDetail('sub',${safeJson(s)},'${esc(s.service_name)}')">
            <td>${esc(s.service_name)}</td><td>$${s.amount?.toFixed(2)}</td>
            <td>${s.billing_frequency}</td><td>${s.next_billing_date}</td>
          </tr>`).join('')}
        </tbody>
      </table>` : '<div style="color:var(--text3);font-size:12px;padding:8px 0">No active subscriptions.</div>'}
    </div>

    <!-- Upcoming Bills -->
    ${upcomingBills.length ? `<div class="scenario-block">
      <div class="scenario-block-title"><span class="sb-icon">📅</span> Upcoming Billing Events</div>
      ${upcomingBills.map(e => {
        const d = new Date(e.start_datetime*1000).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
        const amt = e.description?.match(/Amount: \$(.+)/)?.[1]||'';
        return `<div class="related-item">
          <span class="related-item-icon">📅</span>
          <div><div class="related-item-main">${esc(e.title)}</div>
          <div class="related-item-sub">${d}${amt?' · $'+amt:''}</div></div></div>`;
      }).join('')}
    </div>` : ''}

    <!-- Support History -->
    <div class="scenario-block">
      <div class="scenario-block-title"><span class="sb-icon">🎫</span> Support History (${tickets.length} tickets · ${emails.length} emails)</div>
      ${tickets.length ? `<table class="related-mini-table">
        <thead><tr><th>ID</th><th>Subject</th><th>Status</th><th>Created</th></tr></thead>
        <tbody>${tickets.map(t => `
          <tr class="link-row" onclick="openDetail('ticket',${safeJson(t)},'${esc(t.subject?.slice(0,40))}')">
            <td class="mono">${t.external_id}</td>
            <td>${esc(t.subject||'').slice(0,55)}</td>
            <td><span class="badge badge-open">${t.status}</span></td>
            <td>${(t.created_at||'').slice(0,10)}</td>
          </tr>`).join('')}
        </tbody>
      </table>` : '<div style="color:var(--text3);font-size:12px;padding:8px 0">No support tickets found.</div>'}
      ${emails.map(e => `
        <div class="related-item" style="margin-top:6px" onclick="openDetail('email',${safeJson(e)},'${esc(e.subject)}')">
          <span class="related-item-icon">📧</span>
          <div><div class="related-item-main">${esc(e.subject)}</div>
          <div class="related-item-sub">From: ${esc(e.sender)} · ${new Date(e.timestamp*1000).toLocaleDateString()}</div></div></div>`).join('')}
    </div>

    <!-- OpenClaw Agent Context -->
    <div class="scenario-block" style="border-color:rgba(129,140,248,0.3)">
      <div class="scenario-block-title" style="color:var(--indigo)"><span class="sb-icon">⚡</span> What OpenClaw Sees When Handling a Request from ${esc(user.name)}</div>
      <div style="font-size:12px;color:var(--text2);line-height:1.7;">
        <p>When ${esc(user.name)} submits a support request or asks a financial question, OpenClaw assembles this complete context in a single multi-service query:</p>
        <ul style="margin:10px 0 10px 18px">
          <li><strong>Identity</strong>: Full profile from FinTrack + contact record (${contact?'found':'not found'})</li>
          <li><strong>Financial state</strong>: ${accts.length} accounts, net balance <span class="${totalBal<0?'amt-neg':'amt-pos'}">$${Math.abs(Math.round(totalBal)).toLocaleString()}</span>, ${txns.length} transactions on record</li>
          <li><strong>Recurring obligations</strong>: ${activeSubs.length} active subscriptions, ~$${monthlySubCost.toFixed(0)}/month</li>
          <li><strong>Calendar</strong>: ${calEvts.length} billing events scheduled</li>
          <li><strong>Support context</strong>: ${tickets.length} previous ticket${tickets.length!==1?'s':''}, ${emails.length} email thread${emails.length!==1?'s':''}</li>
          <li><strong>Top spending categories</strong>: ${topCats.map(([c])=>c).join(', ')||'none'}</li>
        </ul>
        <p style="color:var(--text3);font-size:11px;margin-top:8px">All data assembled from: FinTrack (users/accounts/transactions/subscriptions) · Contacts · Calendar · Email · Zendesk</p>
      </div>
    </div>

  </div>`;
}

/* ══════════════════════════════════════════════════
   PAGINATION HELPER
══════════════════════════════════════════════════ */
function renderPagination(containerId, currentPage, total, onPage) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const el = document.getElementById(containerId);
  if (!el) return;
  if (totalPages <= 1) { el.innerHTML = ''; return; }

  const start = currentPage * PAGE_SIZE + 1;
  const end   = Math.min((currentPage + 1) * PAGE_SIZE, total);

  let html = `<button class="page-btn" ${currentPage===0?'disabled':''} onclick="(${onPage.toString()})(${currentPage-1})">← Prev</button>`;
  html += `<span class="page-info">${start}–${end} of ${total.toLocaleString()}</span>`;

  /* Page numbers (show up to 7 around current) */
  const pages = [];
  for (let i=0; i<totalPages; i++) {
    if (i===0 || i===totalPages-1 || (i>=currentPage-2 && i<=currentPage+2)) pages.push(i);
  }
  let prev = null;
  pages.forEach(p => {
    if (prev !== null && p - prev > 1) html += `<span class="page-info">…</span>`;
    html += `<button class="page-btn${p===currentPage?' active':''}" onclick="(${onPage.toString()})(${p})">${p+1}</button>`;
    prev = p;
  });

  html += `<button class="page-btn" ${currentPage>=totalPages-1?'disabled':''} onclick="(${onPage.toString()})(${currentPage+1})">Next →</button>`;
  el.innerHTML = html;
}

/* ══════════════════════════════════════════════════
   UTILITY FUNCTIONS
══════════════════════════════════════════════════ */
function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function esc(s) {
  return String(s||'').replace(/'/g,"\\'").replace(/\n/g,' ');
}

function hilite(text, q) {
  if (!q) return escHtml(text);
  const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')', 'gi');
  return escHtml(text).replace(re, '<mark style="background:rgba(251,191,36,0.3);color:var(--amber);border-radius:2px">$1</mark>');
}

function safeJson(obj) {
  return escHtml(JSON.stringify(obj)).replace(/'/g,'&apos;');
}

/* ══════════════════════════════════════════════════
   ENTRY POINT — called from app.js after data loads
══════════════════════════════════════════════════ */
function initExplorer() {
  initGlobalSearch();
  initScenarioBuilder();
}
