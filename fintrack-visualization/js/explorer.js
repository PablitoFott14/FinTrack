/* ═══════════════════════════════════════════════════════════════
   FinTrack · OpenClaw — Explorer + Modal Data Chains
   Interaction model: table row click → modal with FK chain
═══════════════════════════════════════════════════════════════ */

const PAGE_SIZE = 50;

/* ─── Sort state per table ─── */
const SORT = {
  users: { col:'user_id', dir:'asc' },
  accts: { col:'account_id', dir:'asc' },
  tx:    { col:'date', dir:'desc' },
  subs:  { col:'subscription_id', dir:'asc' },
};
const PAGE = { users:0, accts:0, tx:0, subs:0 };

/* ══════════════════════════════════════════════════
   MODAL ENGINE
══════════════════════════════════════════════════ */
function openModal(type, badgeLabel, title, bodyHtml) {
  const overlay = document.getElementById('modal-overlay');
  document.getElementById('modal-badge').textContent = badgeLabel;
  document.getElementById('modal-badge').className = `modal-badge badge badge-${type}`;
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.body.style.overflow = '';
}

function handleModalClick(e) {
  if (e.target.id === 'modal-overlay') closeModal();
}

/* ── Chain building helpers ── */
function chainBlock(typeClass, label, count, innerHtml) {
  return `<div class="chain-block ${typeClass}">
    <div class="chain-block-hdr">
      <span class="chain-block-label">${label}</span>
      <span class="chain-block-count">${count}</span>
    </div>
    ${innerHtml}
  </div>`;
}

function chainConnector(fkExpr) {
  return `<div class="chain-connector">
    <div class="chain-line"></div>
    <div class="chain-fk-pill">↓ FK: ${fkExpr}</div>
    <div class="chain-line"></div>
  </div>`;
}

function chainFields(pairs) {
  return `<div class="chain-fields">${pairs.map(([k,v,cls='']) =>
    `<div class="chain-field"><div class="cf-key">${k}</div><div class="cf-val${cls?' '+cls:''}">${v}</div></div>`
  ).join('')}</div>`;
}

function chainTable(headers, rows, onRowClick) {
  const hdr = headers.map(h => `<th>${h}</th>`).join('');
  const bdy = rows.map((r,i) => {
    const cls = onRowClick ? 'linkable' : '';
    const onclick = onRowClick ? `onclick="${onRowClick(r,i)}"` : '';
    return `<tr class="${cls}" ${onclick}>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`;
  }).join('') || `<tr><td colspan="${headers.length}" style="color:var(--text3);text-align:center;padding:16px">No records</td></tr>`;
  return `<table class="chain-mini-table"><thead><tr>${hdr}</tr></thead><tbody>${bdy}</tbody></table>`;
}

function fkCheck(pass, msg) {
  return `<div class="fk-check"><span class="fk-check-icon">${pass?'✅':'❌'}</span><span>${msg}</span></div>`;
}

/* ── Formatters ── */
const $ = v => v == null ? '—' : (v < 0 ? `<span class="amt-neg">-$${Math.abs(v).toFixed(2)}</span>` : `<span class="amt-pos">$${v.toFixed(2)}</span>`);
const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;');
const mono = s => `<span style="font-family:var(--mono);font-size:11px">${esc(s)}</span>`;
const badgeHtml = (cls,t) => `<span class="badge badge-${cls}">${t}</span>`;
const mask = v => v ? `•••-••-${String(v).slice(-4)}` : '—';

/* ══════════════════════════════════════════════════
   USER MODAL
══════════════════════════════════════════════════ */
function openUserModal(userId) {
  const user = FT.users.find(u => u.user_id === userId);
  if (!user) return;

  const accts  = FT.accounts.filter(a => a.user_id === userId);
  const txns   = FT.transactions.filter(t => t.user_id === userId);
  const recent = [...txns].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10);
  const subs   = FT.subscriptions.filter(s => s.user_id === userId);
  const activeSubs = subs.filter(s=>s.status==='Active');
  const totalBal   = accts.reduce((s,a)=>s+a.balance,0);

  const zdUser = (ZD.users||[]).find(u => u.external_id === userId);
  const tickets = zdUser ? (ZD.tickets||[]).filter(t=>t.requester_id===zdUser.id) : [];
  const emails  = (EM.emails||[]).filter(e=>e.sender===user.email);
  const contact = (CT.contacts||[]).find(c=>c.email===user.email);
  const calEvts = (CAL.events||[]).filter(e=>(e.attendees||[]).includes(user.name));
  const catMap  = {};
  txns.filter(t=>t.amount<0).forEach(t=>{catMap[t.category]=(catMap[t.category]||0)+Math.abs(t.amount);});
  const topCat  = Object.entries(catMap).sort((a,b)=>b[1]-a[1])[0];

  let html = '';

  /* Block 1: User record */
  html += chainBlock('cb-user','User Record','1 record', chainFields([
    ['user_id',       mono(user.user_id)],
    ['name',          `<strong>${esc(user.name)}</strong>`],
    ['email',         esc(user.email)],
    ['phone',         esc(user.phone||'—')],
    ['member_since',  user.member_since],
    ['status',        badgeHtml('active', user.status)],
    ['linked_accounts_count', user.linked_accounts_count],
    ['date_of_birth', user.date_of_birth],
    ['ssn',           `<span class="cf-val mono">${mask(user.ssn)}</span>`],
    ['mothers_maiden_name', esc(user.mothers_maiden_name||'—')],
  ]));

  /* FK → Accounts */
  html += chainConnector(`accounts.user_id = "${userId}"`);

  /* Block 2: Accounts */
  html += chainBlock('cb-account','Linked Accounts', `${accts.length} record${accts.length!==1?'s':''}`,
    chainTable(
      ['Account ID','Institution','Type','Last 4','Balance','Status'],
      accts.map(a=>[
        mono(a.account_id), esc(a.institution_name), esc(a.account_type),
        `•••• ${a.last_four}`, $(a.balance), badgeHtml('active',a.status)
      ]),
      (r,i) => `openAccountModal('${accts[i].account_id}')`
    ) +
    fkCheck(accts.length === user.linked_accounts_count,
      accts.length === user.linked_accounts_count
        ? `linked_accounts_count (${user.linked_accounts_count}) matches actual account count (${accts.length})`
        : `⚠ linked_accounts_count says ${user.linked_accounts_count} but found ${accts.length} accounts`)
  );

  /* FK → Transactions */
  html += chainConnector(`transactions.user_id = "${userId}"`);

  /* Block 3: Recent transactions */
  html += chainBlock('cb-tx', `Recent Transactions`, `${txns.length} total`,
    chainTable(
      ['Date','Merchant','Amount','Category','Account'],
      recent.map(t=>[
        t.date, esc(t.merchant), $(t.amount),
        badgeHtml('cat',esc(t.category)), `•••• ${t.account_last_four||'—'}`
      ]),
      (r,i) => `openTransactionModal('${recent[i].transaction_id}')`
    ) +
    (txns.length > 10 ? `<div style="padding:8px 12px;font-size:10px;color:var(--text3)">Showing 10 of ${txns.length}. <button class="link-btn" onclick="closeModal();navigateTo('transactions');filterTxByUser('${userId}')">View all in Transactions tab →</button></div>` : '') +
    (topCat ? `<div style="padding:8px 12px;font-size:11px;color:var(--text2)">Top spending category: <strong>${topCat[0]}</strong> ($${topCat[1].toFixed(2)})</div>` : '')
  );

  /* FK → Subscriptions */
  html += chainConnector(`subscriptions.user_id = "${userId}"`);

  /* Block 4: Subscriptions */
  html += chainBlock('cb-sub', 'Subscriptions', `${activeSubs.length} active / ${subs.length} total`,
    chainTable(
      ['Service','Amount','Frequency','Next Billing','Status'],
      subs.map(s=>[
        esc(s.service_name), `$${s.amount?.toFixed(2)}`, s.billing_frequency,
        s.next_billing_date, badgeHtml(s.status==='Active'?'active':'cancelled',s.status)
      ]),
      (r,i) => `openSubscriptionModal('${subs[i].subscription_id}')`
    )
  );

  /* Block 5: Cross-service links */
  const crossParts = [];
  if (zdUser) crossParts.push(['Zendesk User', `${esc(zdUser.name)} · ID ${zdUser.id} · ${tickets.length} ticket${tickets.length!==1?'s':''}`]);
  if (emails.length) crossParts.push(['Email Threads', `${emails.length} email${emails.length!==1?'s':''} from ${esc(user.email)}`]);
  if (contact) crossParts.push(['Contact Record', esc(contact.description||'Found')]);
  if (calEvts.length) crossParts.push(['Calendar Events', `${calEvts.length} billing event${calEvts.length!==1?'s':''} scheduled`]);
  if (crossParts.length) {
    html += chainConnector('cross-service entity resolution by email / external_id');
    html += chainBlock('cb-cross','Cross-Service Links', `${crossParts.length} services`, chainFields(crossParts));
  }

  openModal('user','USER', user.name, html);
}

/* ══════════════════════════════════════════════════
   ACCOUNT MODAL
══════════════════════════════════════════════════ */
function openAccountModal(accountId) {
  const acct = FT.accounts.find(a => a.account_id === accountId);
  if (!acct) return;
  const owner = FT.users.find(u => u.user_id === acct.user_id);
  const txns  = FT.transactions.filter(t => t.user_id === acct.user_id && t.account_last_four === acct.last_four);
  const recent = [...txns].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,12);

  let html = '';

  html += chainBlock('cb-account','Account Record','1 record', chainFields([
    ['account_id',     mono(acct.account_id)],
    ['institution',    `<strong>${esc(acct.institution_name)}</strong>`],
    ['account_type',   esc(acct.account_type)],
    ['last_four',      `<span class="cf-val mono">•••• ${acct.last_four}</span>`],
    ['balance',        $(acct.balance)],
    ['status',         badgeHtml('active',acct.status)],
    ['user_id',        `<button class="link-btn" onclick="openUserModal('${acct.user_id}')">${esc(acct.user_id)}</button>`],
  ]));

  html += chainConnector(`account.user_id = "${acct.user_id}" → users`);

  html += chainBlock('cb-user','Account Owner','1 record',
    owner
      ? chainFields([
          ['user_id', mono(owner.user_id)],
          ['name', `<strong>${esc(owner.name)}</strong>`],
          ['email', esc(owner.email)],
          ['member_since', owner.member_since],
          ['status', badgeHtml('active',owner.status)],
        ]) +
        fkCheck(true, `account.user_id "${acct.user_id}" → user found: ${owner.name}`)
      : fkCheck(false, `account.user_id "${acct.user_id}" → NO matching user found!`)
  );

  html += chainConnector(`transactions.user_id = "${acct.user_id}" AND transactions.account_last_four = "${acct.last_four}"`);

  html += chainBlock('cb-tx', `Transactions on this Account`, `${txns.length} total`,
    chainTable(
      ['Date','Merchant','Amount','Category'],
      recent.map(t=>[t.date, esc(t.merchant), $(t.amount), badgeHtml('cat',esc(t.category))]),
      (r,i) => `openTransactionModal('${recent[i].transaction_id}')`
    ) +
    (txns.length > 12 ? `<div style="padding:6px 12px;font-size:10px;color:var(--text3)">Showing 12 of ${txns.length}</div>` : '') +
    fkCheck(true, `${txns.length} transactions matched by user_id + account_last_four`)
  );

  openModal('account','ACCOUNT', `${acct.institution_name} — ${acct.account_type} (•••• ${acct.last_four})`, html);
}

/* ══════════════════════════════════════════════════
   TRANSACTION MODAL
══════════════════════════════════════════════════ */
function openTransactionModal(txId) {
  const tx = FT.transactions.find(t => t.transaction_id === txId);
  if (!tx) return;
  const user = FT.users.find(u => u.user_id === tx.user_id);
  const acct = FT.accounts.find(a => a.user_id === tx.user_id && a.last_four === tx.account_last_four);
  const sameMerch = FT.transactions
    .filter(t => t.merchant === tx.merchant && t.transaction_id !== tx.transaction_id)
    .sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);

  let html = '';

  html += chainBlock('cb-tx','Transaction Record','1 record', chainFields([
    ['transaction_id', mono(tx.transaction_id)],
    ['date',           tx.date],
    ['merchant',       `<strong>${esc(tx.merchant)}</strong>`],
    ['amount',         $(tx.amount)],
    ['category',       badgeHtml('cat',esc(tx.category))],
    ['account_last4',  `<span class="cf-val mono">•••• ${tx.account_last_four||'—'}</span>`],
    ['user_id',        `<button class="link-btn" onclick="openUserModal('${tx.user_id}')">${tx.user_id}</button>`],
  ]));

  html += chainConnector(`transaction.user_id = "${tx.user_id}" → users`);

  html += chainBlock('cb-user','User',  '1 record',
    user
      ? chainFields([
          ['user_id',      mono(user.user_id)],
          ['name',         `<button class="link-btn" onclick="openUserModal('${user.user_id}')">${esc(user.name)}</button>`],
          ['email',        esc(user.email)],
          ['member_since', user.member_since],
        ]) + fkCheck(true, `transaction.user_id "${tx.user_id}" → user found: ${user.name}`)
      : fkCheck(false, `transaction.user_id "${tx.user_id}" → NO matching user!`)
  );

  if (tx.account_last_four) {
    html += chainConnector(`transaction.user_id + account_last_four "${tx.account_last_four}" → accounts`);
    html += chainBlock('cb-account','Account', '1 record',
      acct
        ? chainFields([
            ['account_id',  mono(acct.account_id)],
            ['institution', `<button class="link-btn" onclick="openAccountModal('${acct.account_id}')">${esc(acct.institution_name)}</button>`],
            ['type',        esc(acct.account_type)],
            ['last_four',   `<span class="cf-val mono">•••• ${acct.last_four}</span>`],
            ['balance',     $(acct.balance)],
          ]) + fkCheck(true, `Matched account ${acct.account_id} (${acct.institution_name})`)
        : fkCheck(false, `No account matched user_id="${tx.user_id}" + last_four="${tx.account_last_four}"`)
    );
  }

  if (sameMerch.length) {
    html += chainConnector(`other transactions at "${esc(tx.merchant)}"`);
    html += chainBlock('cb-tx', `Other Transactions at ${esc(tx.merchant)}`, `${sameMerch.length} shown`,
      chainTable(
        ['Date','User','Amount','Category'],
        sameMerch.map(t=>{
          const u=FT.users.find(x=>x.user_id===t.user_id);
          return [t.date, esc(u?.name||t.user_id), $(t.amount), badgeHtml('cat',esc(t.category))];
        }),
        (r,i) => `openTransactionModal('${sameMerch[i].transaction_id}')`
      )
    );
  }

  openModal('tx','TRANSACTION', `${tx.merchant} · ${tx.date}`, html);
}

/* ══════════════════════════════════════════════════
   SUBSCRIPTION MODAL
══════════════════════════════════════════════════ */
function openSubscriptionModal(subId) {
  const sub = FT.subscriptions.find(s => s.subscription_id === subId);
  if (!sub) return;
  const user = FT.users.find(u => u.user_id === sub.user_id);
  const keyword = sub.service_name.split(' ')[0].toLowerCase();
  const relTxns = FT.transactions
    .filter(t => t.user_id === sub.user_id && t.merchant.toLowerCase().includes(keyword))
    .sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);
  const otherSubs = FT.subscriptions.filter(s => s.user_id === sub.user_id && s.subscription_id !== sub.subscription_id);
  const calEvts = (CAL.events||[]).filter(e =>
    (e.attendees||[]).includes(user?.name) && e.description?.includes(sub.service_name)
  );

  let html = '';

  html += chainBlock('cb-sub','Subscription Record','1 record', chainFields([
    ['subscription_id', mono(sub.subscription_id)],
    ['service_name',    `<strong>${esc(sub.service_name)}</strong>`],
    ['amount',          `$${sub.amount?.toFixed(2)}`],
    ['billing_frequency', sub.billing_frequency],
    ['next_billing_date', sub.next_billing_date],
    ['status',          badgeHtml(sub.status==='Active'?'active':'cancelled', sub.status)],
    ['user_id',         `<button class="link-btn" onclick="openUserModal('${sub.user_id}')">${sub.user_id}</button>`],
  ]));

  html += chainConnector(`subscription.user_id = "${sub.user_id}" → users`);

  html += chainBlock('cb-user','Subscriber','1 record',
    user
      ? chainFields([
          ['user_id',      mono(user.user_id)],
          ['name',         `<button class="link-btn" onclick="openUserModal('${user.user_id}')">${esc(user.name)}</button>`],
          ['email',        esc(user.email)],
          ['member_since', user.member_since],
        ]) + fkCheck(true, `subscription.user_id "${sub.user_id}" → user found: ${user.name}`)
      : fkCheck(false, `subscription.user_id "${sub.user_id}" → NO matching user!`)
  );

  if (relTxns.length) {
    html += chainConnector(`transactions matching merchant keyword "${keyword}" for this user`);
    html += chainBlock('cb-tx','Related Transactions (by merchant keyword)', `${relTxns.length} found`,
      chainTable(
        ['Date','Merchant','Amount'],
        relTxns.map(t=>[t.date, esc(t.merchant), $(t.amount)]),
        (r,i) => `openTransactionModal('${relTxns[i].transaction_id}')`
      )
    );
  }

  if (calEvts.length) {
    html += chainConnector(`calendar events for "${esc(sub.service_name)}" → ${user?.name}`);
    html += chainBlock('cb-cross','Billing Calendar Events', `${calEvts.length} found`,
      chainTable(
        ['Date','Title','Amount','Status'],
        calEvts.map(e=>{
          const d = new Date(e.start_datetime*1000).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
          const amt = e.description?.match(/Amount: \$(.+)/)?.[1]||'—';
          const st  = e.description?.match(/Status: (.+)/)?.[1]||'—';
          return [d, esc(e.title), `$${amt}`, st];
        }), null
      )
    );
  }

  if (otherSubs.length) {
    html += chainConnector(`other subscriptions for user "${sub.user_id}"`);
    html += chainBlock('cb-sub',`Other Subscriptions for ${user?.name||sub.user_id}`, `${otherSubs.length}`,
      chainTable(
        ['Service','Amount','Frequency','Status'],
        otherSubs.map(s=>[esc(s.service_name),`$${s.amount?.toFixed(2)}`,s.billing_frequency,badgeHtml(s.status==='Active'?'active':'cancelled',s.status)]),
        (r,i) => `openSubscriptionModal('${otherSubs[i].subscription_id}')`
      )
    );
  }

  openModal('sub','SUBSCRIPTION', `${sub.service_name} — ${user?.name||sub.user_id}`, html);
}

/* ══════════════════════════════════════════════════
   TICKET MODAL
══════════════════════════════════════════════════ */
function openTicketModal(ticketId) {
  const ticket = (ZD.tickets||[]).find(t => t.id === ticketId);
  if (!ticket) return;

  const zdUser = (ZD.users||[]).find(u => u.id === ticket.requester_id);
  const ftUser = zdUser ? FT.users.find(u => u.user_id === zdUser.external_id) : null;
  const accts  = ftUser ? FT.accounts.filter(a => a.user_id === ftUser.user_id) : [];
  const recent = ftUser ? [...FT.transactions.filter(t=>t.user_id===ftUser.user_id)].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8) : [];
  const email  = (EM.emails||[]).find(e => e.sender === zdUser?.email);

  let html = '';

  html += chainBlock('cb-ticket','Support Ticket','1 record', chainFields([
    ['ticket_id',  mono(ticket.external_id||`TKT${ticket.id}`)],
    ['subject',    `<strong>${esc(ticket.subject)}</strong>`],
    ['description', `<div style="font-size:11px;color:var(--text2);line-height:1.55;max-height:80px;overflow-y:auto">${esc(ticket.description)}</div>`],
    ['status',     badgeHtml('open',ticket.status)],
    ['priority',   badgeHtml('normal',ticket.priority||'normal')],
    ['type',       ticket.type||'question'],
    ['channel',    ticket.via_channel||'web'],
    ['created',    (ticket.created_at||'').slice(0,16).replace('T',' ')],
  ]));

  if (zdUser) {
    html += chainConnector(`ticket.requester_id = ${ticket.requester_id} → zendesk.users`);
    html += chainBlock('cb-user','Zendesk Requester','1 record', chainFields([
      ['zendesk_id',  mono(zdUser.id)],
      ['name',        esc(zdUser.name)],
      ['email',       esc(zdUser.email)],
      ['external_id', mono(zdUser.external_id||'—')],
      ['role',        zdUser.role],
    ]) + fkCheck(!!zdUser, `ticket.requester_id ${ticket.requester_id} → Zendesk user: ${zdUser.name}`));
  }

  if (ftUser) {
    html += chainConnector(`zendesk.external_id = "${zdUser?.external_id}" → fintrack.users`);
    html += chainBlock('cb-user','FinTrack User Profile','1 record',
      chainFields([
        ['user_id',      `<button class="link-btn" onclick="openUserModal('${ftUser.user_id}')">${mono(ftUser.user_id)}</button>`],
        ['name',         `<strong>${esc(ftUser.name)}</strong>`],
        ['email',        esc(ftUser.email)],
        ['member_since', ftUser.member_since],
        ['linked_accounts', ftUser.linked_accounts_count],
      ]) +
      fkCheck(true, `external_id "${zdUser?.external_id}" → FinTrack user: ${ftUser.name}`)
    );

    if (accts.length) {
      html += chainConnector(`accounts.user_id = "${ftUser.user_id}" (financial context)`);
      html += chainBlock('cb-account','User Financial Accounts', `${accts.length} accounts`,
        chainTable(
          ['Institution','Type','Last 4','Balance','Status'],
          accts.map(a=>[esc(a.institution_name),esc(a.account_type),`•••• ${a.last_four}`,$(a.balance),badgeHtml('active',a.status)]),
          (r,i) => `openAccountModal('${accts[i].account_id}')`
        ) +
        `<div style="padding:7px 12px;font-size:11px;color:var(--text2)">Net balance: <strong>${$(accts.reduce((s,a)=>s+a.balance,0))}</strong></div>`
      );
    }

    if (recent.length) {
      html += chainConnector(`transactions.user_id = "${ftUser.user_id}" (recent activity)`);
      html += chainBlock('cb-tx','Recent Transactions', `${FT.transactions.filter(t=>t.user_id===ftUser.user_id).length} total`,
        chainTable(
          ['Date','Merchant','Amount','Category'],
          recent.map(t=>[t.date,esc(t.merchant),$(t.amount),badgeHtml('cat',esc(t.category))]),
          (r,i) => `openTransactionModal('${recent[i].transaction_id}')`
        )
      );
    }
  } else if (zdUser) {
    html += fkCheck(false, `zendesk.external_id "${zdUser?.external_id}" → NO matching FinTrack user!`);
  }

  if (email) {
    html += chainConnector(`email.sender = "${zdUser?.email}" → email thread`);
    html += chainBlock('cb-cross','Linked Email Thread','1 email',
      chainFields([
        ['subject',   `<strong>${esc(email.subject)}</strong>`],
        ['from',      esc(email.sender)],
        ['timestamp', new Date((email.timestamp||0)*1000).toISOString().slice(0,16).replace('T',' ')],
        ['content',   `<div style="font-size:11px;color:var(--text2);line-height:1.55;max-height:70px;overflow-y:auto">${esc(email.content||'')}</div>`],
      ])
    );
  }

  openModal('ticket','TICKET', `${ticket.external_id||'TKT'+ticket.id} — ${ticket.subject}`, html);
}

/* ══════════════════════════════════════════════════
   USERS TABLE
══════════════════════════════════════════════════ */
function renderUsersPage() {
  bindEvent('users-search', 'input', debounce(()=>{PAGE.users=0;drawUsersTable();},200));
  bindEvent('users-sort', 'change', ()=>{PAGE.users=0;SORT.users.col=document.getElementById('users-sort').value;drawUsersTable();});
  drawUsersTable();
}

function drawUsersTable() {
  const q = (val('users-search')||'').toLowerCase();
  let rows = FT.users.filter(u =>
    !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.user_id.toLowerCase().includes(q)
  );
  const { col, dir } = SORT.users;
  rows.sort((a,b)=>{
    const av=a[col]||'', bv=b[col]||'';
    const c = typeof av==='number' ? av-bv : String(av).localeCompare(String(bv));
    return dir==='asc'?c:-c;
  });
  document.getElementById('users-count').textContent = `${rows.length} users`;
  const page = PAGE.users;
  const slice = rows.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
  const html = `<table class="data-table">
    <thead><tr>
      <th style="width:70px">ID</th><th>Name</th><th>Email</th>
      <th style="width:120px">Member Since</th>
      <th style="width:80px">Accounts</th>
      <th style="width:80px">Status</th>
    </tr></thead>
    <tbody>${slice.map(u=>`
      <tr class="clickable" onclick="openUserModal('${u.user_id}')">
        <td>${mono(u.user_id)}</td>
        <td><strong>${esc(u.name)}</strong></td>
        <td style="color:var(--text2)">${esc(u.email)}</td>
        <td>${u.member_since}</td>
        <td>${u.linked_accounts_count}</td>
        <td>${badgeHtml('active',u.status)}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
  document.getElementById('users-table-wrap').innerHTML = html;
  renderPag('users-pag', page, rows.length, p=>{PAGE.users=p;drawUsersTable();});
}

/* ══════════════════════════════════════════════════
   ACCOUNTS TABLE
══════════════════════════════════════════════════ */
function renderAccountsPage() {
  const types = [...new Set(FT.accounts.map(a=>a.account_type))].sort();
  const insts = [...new Set(FT.accounts.map(a=>a.institution_name))].sort();
  populateSelect('accts-type', types);
  populateSelect('accts-inst', insts);
  bindEvent('accts-search','input',debounce(()=>{PAGE.accts=0;drawAccountsTable();},200));
  bindEvent('accts-type','change',()=>{PAGE.accts=0;drawAccountsTable();});
  bindEvent('accts-inst','change',()=>{PAGE.accts=0;drawAccountsTable();});
  drawAccountsTable();
}

function drawAccountsTable() {
  const q    = (val('accts-search')||'').toLowerCase();
  const type = val('accts-type')||'';
  const inst = val('accts-inst')||'';
  let rows = FT.accounts.filter(a=>
    (!q    || a.institution_name.toLowerCase().includes(q) || a.account_type.toLowerCase().includes(q) || (a.last_four||'').includes(q) || a.user_id.toLowerCase().includes(q)) &&
    (!type || a.account_type===type) &&
    (!inst || a.institution_name===inst)
  );
  document.getElementById('accts-count').textContent = `${rows.length} accounts`;
  const page = PAGE.accts;
  const slice = rows.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
  const html = `<table class="data-table">
    <thead><tr>
      <th style="width:80px">Acct ID</th><th>Institution</th><th>Type</th>
      <th style="width:90px">Last Four</th><th style="width:120px">Balance</th>
      <th style="width:80px">Status</th><th>Owner</th>
    </tr></thead>
    <tbody>${slice.map(a=>{
      const owner=FT.users.find(u=>u.user_id===a.user_id);
      return `<tr class="clickable" onclick="openAccountModal('${a.account_id}')">
        <td>${mono(a.account_id)}</td>
        <td><strong>${esc(a.institution_name)}</strong></td>
        <td>${esc(a.account_type)}</td>
        <td style="font-family:var(--mono)">•••• ${a.last_four}</td>
        <td class="${a.balance<0?'amt-neg':'amt-pos'}">$${Math.abs(a.balance).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
        <td>${badgeHtml('active',a.status)}</td>
        <td><button class="link-btn" onclick="event.stopPropagation();openUserModal('${a.user_id}')">${esc(owner?.name||a.user_id)}</button></td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>`;
  document.getElementById('accts-table-wrap').innerHTML = html;
  renderPag('accts-pag', page, rows.length, p=>{PAGE.accts=p;drawAccountsTable();});
}

/* ══════════════════════════════════════════════════
   TRANSACTIONS TABLE
══════════════════════════════════════════════════ */
function renderTransactionsPage() {
  const cats = [...new Set(FT.transactions.map(t=>t.category))].sort();
  populateSelect('tx-cat', cats);
  FT.users.slice(0,100).forEach(u=>{
    const opt=document.createElement('option');opt.value=u.user_id;opt.textContent=u.name;
    document.getElementById('tx-user').appendChild(opt);
  });
  const bind = debounce(()=>{PAGE.tx=0;drawTxTable();},200);
  ['tx-search','tx-cat','tx-user','tx-from','tx-to','tx-min','tx-max'].forEach(id=>bindEvent(id,'input',bind));
  ['tx-cat','tx-user'].forEach(id=>bindEvent(id,'change',bind));
  bindEvent('tx-clear-btn','click',()=>{
    ['tx-search','tx-from','tx-to','tx-min','tx-max'].forEach(id=>{ const el=document.getElementById(id); if(el)el.value=''; });
    ['tx-cat','tx-user'].forEach(id=>{ const el=document.getElementById(id); if(el)el.value=''; });
    PAGE.tx=0; drawTxTable();
  });
  drawTxTable();
}

function drawTxTable() {
  const q    = (val('tx-search')||'').toLowerCase();
  const cat  = val('tx-cat')||'';
  const uid  = val('tx-user')||'';
  const from = val('tx-from')||'';
  const to   = val('tx-to')||'';
  const min  = val('tx-min');
  const max  = val('tx-max');

  let rows = FT.transactions.filter(t=>{
    if (q   && !t.merchant.toLowerCase().includes(q)) return false;
    if (cat && t.category!==cat) return false;
    if (uid && t.user_id!==uid)  return false;
    if (from && t.date<from)     return false;
    if (to   && t.date>to)       return false;
    const a = Math.abs(t.amount);
    if (min && a < parseFloat(min)) return false;
    if (max && a > parseFloat(max)) return false;
    return true;
  });

  const {col,dir} = SORT.tx;
  rows.sort((a,b)=>{
    let av=a[col], bv=b[col];
    if (col==='amount'){av=Math.abs(av);bv=Math.abs(bv);}
    const c = typeof av==='number'?av-bv:String(av||'').localeCompare(String(bv||''));
    return dir==='asc'?c:-c;
  });

  document.getElementById('tx-count').textContent = `${rows.length.toLocaleString()} transactions`;
  const page = PAGE.tx;
  const slice = rows.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
  const sortTh = (label,c) => `<th class="${SORT.tx.col===c?'sorted-'+SORT.tx.dir:''}" onclick="txSortBy('${c}')">${label}</th>`;
  const html = `<table class="data-table">
    <thead><tr>
      ${sortTh('Date','date')}
      <th>User</th>
      ${sortTh('Merchant','merchant')}
      ${sortTh('Amount','amount')}
      <th>Category</th>
      <th style="width:100px">Account</th>
      <th style="width:70px;color:var(--text4)">TX ID</th>
    </tr></thead>
    <tbody>${slice.map(t=>{
      const u=FT.users.find(x=>x.user_id===t.user_id);
      return `<tr class="clickable" onclick="openTransactionModal('${t.transaction_id}')">
        <td>${t.date}</td>
        <td><button class="link-btn" onclick="event.stopPropagation();openUserModal('${t.user_id}')">${esc(u?.name||t.user_id)}</button></td>
        <td><strong>${esc(t.merchant)}</strong></td>
        <td class="${t.amount<0?'amt-neg':'amt-pos'}">$${Math.abs(t.amount).toFixed(2)}</td>
        <td>${badgeHtml('cat',esc(t.category))}</td>
        <td style="font-family:var(--mono);font-size:11px">•••• ${t.account_last_four||'—'}</td>
        <td style="font-family:var(--mono);font-size:10px;color:var(--text4)">${t.transaction_id}</td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>`;
  document.getElementById('tx-table-wrap').innerHTML = html;
  renderPag('tx-pag', page, rows.length, p=>{PAGE.tx=p;drawTxTable();});
}

function txSortBy(col) {
  if (SORT.tx.col===col) SORT.tx.dir = SORT.tx.dir==='asc'?'desc':'asc';
  else { SORT.tx.col=col; SORT.tx.dir='desc'; }
  PAGE.tx=0; drawTxTable();
}

function filterTxByUser(userId) {
  navigateTo('transactions');
  setTimeout(()=>{
    const el=document.getElementById('tx-user'); if(el)el.value=userId;
    PAGE.tx=0; drawTxTable();
  },100);
}

/* ══════════════════════════════════════════════════
   SUBSCRIPTIONS TABLE
══════════════════════════════════════════════════ */
function renderSubscriptionsPage() {
  const freqs = [...new Set(FT.subscriptions.map(s=>s.billing_frequency))].sort();
  populateSelect('sub-freq', freqs);
  const bind = debounce(()=>{PAGE.subs=0;drawSubsTable();},200);
  ['sub-search','sub-status','sub-freq'].forEach(id=>{bindEvent(id,'input',bind);bindEvent(id,'change',bind);});
  drawSubsTable();
}

function drawSubsTable() {
  const q   = (val('sub-search')||'').toLowerCase();
  const st  = val('sub-status')||'';
  const fr  = val('sub-freq')||'';
  let rows = FT.subscriptions.filter(s=>
    (!q  || s.service_name.toLowerCase().includes(q) || s.user_id.toLowerCase().includes(q)) &&
    (!st || s.status===st) &&
    (!fr || s.billing_frequency===fr)
  );
  document.getElementById('sub-count').textContent = `${rows.length} subscriptions`;
  const page = PAGE.subs;
  const slice = rows.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
  const html = `<table class="data-table">
    <thead><tr>
      <th style="width:80px">Sub ID</th><th>User</th><th>Service</th>
      <th style="width:90px">Amount</th><th style="width:110px">Frequency</th>
      <th style="width:120px">Next Billing</th><th style="width:90px">Status</th>
    </tr></thead>
    <tbody>${slice.map(s=>{
      const u=FT.users.find(x=>x.user_id===s.user_id);
      return `<tr class="clickable" onclick="openSubscriptionModal('${s.subscription_id}')">
        <td>${mono(s.subscription_id)}</td>
        <td><button class="link-btn" onclick="event.stopPropagation();openUserModal('${s.user_id}')">${esc(u?.name||s.user_id)}</button></td>
        <td><strong>${esc(s.service_name)}</strong></td>
        <td>$${s.amount?.toFixed(2)}</td>
        <td>${badgeHtml('cat',s.billing_frequency)}</td>
        <td>${s.next_billing_date}</td>
        <td>${badgeHtml(s.status==='Active'?'active':'cancelled',s.status)}</td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>`;
  document.getElementById('sub-table-wrap').innerHTML = html;
  renderPag('sub-pag', page, rows.length, p=>{PAGE.subs=p;drawSubsTable();});
}

/* ══════════════════════════════════════════════════
   SUPPORT MESSAGES
══════════════════════════════════════════════════ */
function renderSupportPage() {
  bindEvent('sup-search','input',debounce(drawSupportMessages,200));
  drawSupportMessages();
}

function drawSupportMessages() {
  const q = (val('sup-search')||'').toLowerCase();
  const zdUserMap = {};
  (ZD.users||[]).forEach(u=>{zdUserMap[u.id]=u;});

  const tickets = (ZD.tickets||[]).filter(t=>
    !q || t.subject?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || t.external_id?.toLowerCase().includes(q)
  );
  document.getElementById('sup-count').textContent = `${tickets.length} tickets`;

  const html = tickets.map(t=>{
    const zd = zdUserMap[t.requester_id];
    const ft = zd ? FT.users.find(u=>u.user_id===zd.external_id) : null;
    const email = (EM.emails||[]).find(e=>e.sender===zd?.email);
    const accts = ft ? FT.accounts.filter(a=>a.user_id===ft.user_id) : [];
    const bal   = accts.reduce((s,a)=>s+a.balance,0);
    return `<div class="message-card" onclick="openTicketModal(${t.id})">
      <div class="message-card-header">
        <div>
          <div class="message-sender">${esc(zd?.name||'Unknown User')}</div>
          <div class="message-meta">${esc(zd?.email||'')} · ${(t.created_at||'').slice(0,16).replace('T',' ')} · ${t.external_id||'TKT'+t.id}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          ${badgeHtml('open',t.status)}
          ${ft ? `<div style="font-size:10px;color:var(--text3);margin-top:4px">${ft.user_id} · ${accts.length} accts · <span class="${bal<0?'amt-neg':'amt-pos'}">$${Math.abs(Math.round(bal)).toLocaleString()}</span></div>` : '<div style="font-size:10px;color:var(--rose);margin-top:4px">No FinTrack account</div>'}
        </div>
      </div>
      <div class="message-subject">${esc(t.subject||'')}</div>
      <div class="message-body">${esc(t.description||'').slice(0,180)}${(t.description||'').length>180?'…':''}</div>
      <div class="message-tags">
        ${(t.tags||[]).map(tag=>`${badgeHtml('cat',tag)}`).join('')}
        ${email ? `<span class="badge badge-cat">📧 email linked</span>` : ''}
        ${ft ? `<button class="link-btn" onclick="event.stopPropagation();openUserModal('${ft.user_id}')">View ${ft.name}'s full profile →</button>` : ''}
      </div>
    </div>`;
  }).join('') || '<div class="empty-state">No tickets found.</div>';

  document.getElementById('sup-messages-wrap').innerHTML = html;
}

/* ══════════════════════════════════════════════════
   DATA INTEGRITY
══════════════════════════════════════════════════ */
function renderIntegrityPage() {
  const tests = runIntegrityTests();
  const html = `<div class="integrity-grid">${tests.map(t=>`
    <div class="integrity-card">
      <div class="integrity-card-hdr">
        <span class="integrity-card-title">${t.name}</span>
        <span class="${t.pass?'integrity-badge-pass':t.warn?'integrity-badge-warn':'integrity-badge-fail'}">${t.pass?'✅ PASS':t.warn?'⚠ WARN':'❌ FAIL'}</span>
      </div>
      <div class="integrity-card-body">
        ${t.message}
        ${t.detail?`<div class="integrity-detail">${t.detail}</div>`:''}
        ${t.issues?.length ? `<div class="integrity-issues">${t.issues.slice(0,10).map(i=>`<div class="integrity-issue-row">⟶ ${esc(i)}</div>`).join('')}${t.issues.length>10?`<div class="integrity-issue-row">…and ${t.issues.length-10} more</div>`:''}</div>` : ''}
      </div>
    </div>`).join('')}</div>`;
  document.getElementById('integrity-results').innerHTML = html;
}

function runIntegrityTests() {
  const tests = [];
  const userIds = new Set(FT.users.map(u=>u.user_id));

  /* 1. FK: accounts → users */
  const badAcctFKs = FT.accounts.filter(a=>!userIds.has(a.user_id));
  tests.push({
    name:'FK: accounts.user_id → users',
    pass: badAcctFKs.length===0,
    message: badAcctFKs.length===0
      ? `All ${FT.accounts.length} accounts reference valid users.`
      : `${badAcctFKs.length} accounts reference non-existent user_ids.`,
    detail: `Checked ${FT.accounts.length} account records`,
    issues: badAcctFKs.map(a=>`${a.account_id}: user_id="${a.user_id}" not found`),
  });

  /* 2. FK: transactions → users */
  const badTxFKs = FT.transactions.filter(t=>!userIds.has(t.user_id));
  tests.push({
    name:'FK: transactions.user_id → users',
    pass: badTxFKs.length===0,
    message: badTxFKs.length===0
      ? `All ${FT.transactions.length.toLocaleString()} transactions reference valid users.`
      : `${badTxFKs.length} transactions reference non-existent user_ids.`,
    detail: `Checked ${FT.transactions.length.toLocaleString()} transaction records`,
    issues: badTxFKs.map(t=>`${t.transaction_id}: user_id="${t.user_id}" not found`),
  });

  /* 3. FK: transactions account match */
  const acctKeySet = new Set(FT.accounts.map(a=>`${a.user_id}::${a.last_four}`));
  const badTxAcct = FT.transactions.filter(t=>t.account_last_four && !acctKeySet.has(`${t.user_id}::${t.account_last_four}`));
  tests.push({
    name:'FK: transactions → accounts (user_id + last_four)',
    pass: badTxAcct.length===0,
    message: badTxAcct.length===0
      ? `All transactions with account_last_four match a known account.`
      : `${badTxAcct.length} transactions reference unknown account (user+last4 combo).`,
    issues: badTxAcct.slice(0,10).map(t=>`${t.transaction_id}: ${t.user_id} + ****${t.account_last_four} not in accounts`),
  });

  /* 4. FK: subscriptions → users */
  const badSubFKs = FT.subscriptions.filter(s=>!userIds.has(s.user_id));
  tests.push({
    name:'FK: subscriptions.user_id → users',
    pass: badSubFKs.length===0,
    message: badSubFKs.length===0
      ? `All ${FT.subscriptions.length} subscriptions reference valid users.`
      : `${badSubFKs.length} subscriptions reference non-existent user_ids.`,
    issues: badSubFKs.map(s=>`${s.subscription_id}: user_id="${s.user_id}" not found`),
  });

  /* 5. Unique user IDs */
  const dupUsers = findDuplicates(FT.users.map(u=>u.user_id));
  tests.push({
    name:'Primary Key: users.user_id uniqueness',
    pass: dupUsers.length===0,
    message: dupUsers.length===0
      ? `All ${FT.users.length} user IDs are unique.`
      : `${dupUsers.length} duplicate user_ids found.`,
    issues: dupUsers,
  });

  /* 6. Unique transaction IDs */
  const dupTxs = findDuplicates(FT.transactions.map(t=>t.transaction_id));
  tests.push({
    name:'Primary Key: transactions.transaction_id uniqueness',
    pass: dupTxs.length===0,
    message: dupTxs.length===0
      ? `All ${FT.transactions.length.toLocaleString()} transaction IDs are unique.`
      : `${dupTxs.length} duplicate transaction_ids found.`,
    issues: dupTxs,
  });

  /* 7. linked_accounts_count accuracy */
  const acctCountByUser = {};
  FT.accounts.forEach(a=>{acctCountByUser[a.user_id]=(acctCountByUser[a.user_id]||0)+1;});
  const countMismatches = FT.users.filter(u=>(acctCountByUser[u.user_id]||0)!==u.linked_accounts_count);
  tests.push({
    name:'Data Consistency: linked_accounts_count accuracy',
    pass: countMismatches.length===0,
    warn: countMismatches.length>0 && countMismatches.length<10,
    message: countMismatches.length===0
      ? `All users' linked_accounts_count matches their actual account count.`
      : `${countMismatches.length} users have mismatched linked_accounts_count.`,
    issues: countMismatches.slice(0,10).map(u=>`${u.user_id}: stated ${u.linked_accounts_count}, actual ${acctCountByUser[u.user_id]||0}`),
  });

  /* 8. Zendesk external_ids */
  const zdExternal = (ZD.users||[]).filter(u=>u.external_id && u.external_id!=='fintrack-agent-001').map(u=>u.external_id);
  const badZdFKs = zdExternal.filter(id=>!userIds.has(id));
  tests.push({
    name:'FK: zendesk.external_id → fintrack users',
    pass: badZdFKs.length===0,
    message: badZdFKs.length===0
      ? `All ${zdExternal.length} Zendesk external_ids point to valid FinTrack users.`
      : `${badZdFKs.length} Zendesk external_ids have no matching FinTrack user.`,
    issues: badZdFKs.map(id=>`external_id="${id}" not found in users`),
  });

  /* 9. Calendar-subscription sync */
  const calStatuses = {};
  (CAL.events||[]).forEach(e=>{
    const st = e.description?.match(/Status: (.+)/)?.[1];
    const svc = e.description?.match(/Subscription: (.+)/)?.[1];
    if (svc && st==='Cancelled') calStatuses[svc]=(calStatuses[svc]||0)+1;
  });
  const cancelledEvtCount = Object.values(calStatuses).reduce((s,v)=>s+v,0);
  tests.push({
    name:'Calendar: cancelled subscriptions in events',
    pass: cancelledEvtCount===0,
    warn: cancelledEvtCount>0,
    message: cancelledEvtCount===0
      ? `No cancelled subscriptions found in calendar events.`
      : `${cancelledEvtCount} calendar events reference cancelled subscriptions — these may be stale.`,
    detail: cancelledEvtCount>0 ? `Services with cancelled events: ${Object.keys(calStatuses).slice(0,5).join(', ')}` : '',
  });

  /* 10. Email sender → FinTrack user linkage */
  const emailSenders = [...new Set((EM.emails||[]).map(e=>e.sender))];
  const userEmails = new Set(FT.users.map(u=>u.email));
  const unmatchedSenders = emailSenders.filter(e=>!userEmails.has(e) && e!=='support@fintrack.example.com');
  tests.push({
    name:'Email: sender addresses → FinTrack users',
    pass: unmatchedSenders.length===0,
    warn: unmatchedSenders.length>0,
    message: unmatchedSenders.length===0
      ? `All email senders are registered FinTrack users.`
      : `${unmatchedSenders.length} email senders have no matching FinTrack user record.`,
    issues: unmatchedSenders.map(e=>`sender "${e}" not in fintrack users`),
  });

  /* 11. Valid transaction amounts */
  const invalidAmts = FT.transactions.filter(t=>t.amount==null||isNaN(t.amount)||t.amount===0);
  tests.push({
    name:'Data Quality: valid transaction amounts',
    pass: invalidAmts.length===0,
    message: invalidAmts.length===0
      ? `All ${FT.transactions.length.toLocaleString()} transactions have valid non-zero amounts.`
      : `${invalidAmts.length} transactions have null, NaN, or zero amounts.`,
    issues: invalidAmts.map(t=>`${t.transaction_id}: amount=${t.amount}`),
  });

  /* 12. Contacts ↔ Users sync */
  const ctEmails = new Set((CT.contacts||[]).map(c=>c.email));
  const usersWithoutContact = FT.users.filter(u=>!ctEmails.has(u.email));
  tests.push({
    name:'Contacts: FinTrack users with contact records',
    pass: usersWithoutContact.length<5,
    warn: usersWithoutContact.length>0,
    message: usersWithoutContact.length===0
      ? `All ${FT.users.length} users have a corresponding contact record.`
      : `${FT.users.length-usersWithoutContact.length} of ${FT.users.length} users have a contact record (${usersWithoutContact.length} missing).`,
    detail: `Contact coverage: ${(((FT.users.length-usersWithoutContact.length)/FT.users.length)*100).toFixed(1)}%`,
  });

  return tests;
}

function findDuplicates(arr) {
  const seen={}, dups=[];
  arr.forEach(id=>{
    if (seen[id]) dups.push(id);
    else seen[id]=true;
  });
  return dups;
}

/* ══════════════════════════════════════════════════
   GLOBAL SEARCH
══════════════════════════════════════════════════ */
function initGlobalSearch() {
  const input = document.getElementById('global-search');
  const dd    = document.getElementById('search-dropdown');
  if (!input) return;
  let timer;
  input.addEventListener('input', ()=>{ clearTimeout(timer); timer=setTimeout(()=>runSearch(input.value.trim()),220); });
  input.addEventListener('blur', ()=>{ setTimeout(()=>dd.classList.add('hidden'),200); });
  input.addEventListener('focus', ()=>{ if(input.value.trim().length>=2) dd.classList.remove('hidden'); });
}

function runSearch(q) {
  const dd = document.getElementById('search-dropdown');
  if (q.length<2) { dd.classList.add('hidden'); return; }
  const ql = q.toLowerCase();
  const hilite = (s,q_) => {
    const re=new RegExp('('+q_.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi');
    return esc(s).replace(re,'<mark>$1</mark>');
  };

  const users = FT.users.filter(u=>u.name.toLowerCase().includes(ql)||u.email.toLowerCase().includes(ql)||u.user_id.toLowerCase().includes(ql)).slice(0,4);
  const txs   = FT.transactions.filter(t=>t.merchant.toLowerCase().includes(ql)||t.category.toLowerCase().includes(ql)).slice(0,4);
  const accts = FT.accounts.filter(a=>a.institution_name.toLowerCase().includes(ql)||a.account_type.toLowerCase().includes(ql)||(a.last_four||'').includes(ql)).slice(0,3);
  const tkts  = (ZD.tickets||[]).filter(t=>t.subject?.toLowerCase().includes(ql)||t.external_id?.toLowerCase().includes(ql)).slice(0,3);
  const subs  = FT.subscriptions.filter(s=>s.service_name.toLowerCase().includes(ql)).slice(0,3);

  if (!users.length&&!txs.length&&!accts.length&&!tkts.length&&!subs.length) {
    dd.innerHTML=`<div class="sd-empty">No results for "${esc(q)}"</div>`;
    dd.classList.remove('hidden'); return;
  }

  let html='';
  const item=(icon,main,sub,onclick_)=>`<div class="sd-item" onclick="${onclick_};document.getElementById('search-dropdown').classList.add('hidden')"><span class="sd-icon">${icon}</span><div><div class="sd-main">${main}</div><div class="sd-sub">${sub}</div></div></div>`;

  if(users.length){html+=`<div class="sd-group-title">👤 Users</div>`;
    html+=users.map(u=>item('👤',hilite(u.name,ql),`${hilite(u.email,ql)} · ${u.user_id}`,`openUserModal('${u.user_id}')`)).join('');}
  if(txs.length){html+=`<div class="sd-group-title">💳 Transactions</div>`;
    html+=txs.map(t=>{const u=FT.users.find(x=>x.user_id===t.user_id);return item('💳',hilite(t.merchant,ql),`${t.date} · ${u?.name||t.user_id} · $${Math.abs(t.amount).toFixed(2)}`,`openTransactionModal('${t.transaction_id}')`)}).join('');}
  if(accts.length){html+=`<div class="sd-group-title">🏦 Accounts</div>`;
    html+=accts.map(a=>{const u=FT.users.find(x=>x.user_id===a.user_id);return item('🏦',hilite(a.institution_name,ql),`${a.account_type} · •••• ${a.last_four} · ${u?.name||a.user_id}`,`openAccountModal('${a.account_id}')`)}).join('');}
  if(tkts.length){html+=`<div class="sd-group-title">🎫 Tickets</div>`;
    html+=tkts.map(t=>item('🎫',hilite(t.subject||'',ql),`${t.external_id} · ${(t.created_at||'').slice(0,10)}`,`openTicketModal(${t.id})`)).join('');}
  if(subs.length){html+=`<div class="sd-group-title">🔄 Subscriptions</div>`;
    html+=subs.map(s=>{const u=FT.users.find(x=>x.user_id===s.user_id);return item('🔄',hilite(s.service_name,ql),`$${s.amount}/${s.billing_frequency} · ${u?.name||s.user_id}`,`openSubscriptionModal('${s.subscription_id}')`)}).join('');}

  dd.innerHTML=html; dd.classList.remove('hidden');
}

/* ══════════════════════════════════════════════════
   PAGINATION
══════════════════════════════════════════════════ */
function renderPag(containerId, current, total, onPage) {
  const el=document.getElementById(containerId);
  if(!el) return;
  const pages=Math.ceil(total/PAGE_SIZE);
  if(pages<=1){el.innerHTML='';return;}
  const s=current*PAGE_SIZE+1, e=Math.min((current+1)*PAGE_SIZE,total);
  let html=`<button class="page-btn" ${current===0?'disabled':''} onclick="(${onPage.toString()})(${current-1})">← Prev</button>`;
  html+=`<span class="page-info">${s}–${e} of ${total.toLocaleString()}</span>`;
  const nums=new Set([0,pages-1,...Array.from({length:5},(_,i)=>current-2+i).filter(p=>p>=0&&p<pages)]);
  let prev=null;
  [...nums].sort((a,b)=>a-b).forEach(p=>{
    if(prev!==null&&p-prev>1) html+=`<span class="page-info">…</span>`;
    html+=`<button class="page-btn${p===current?' current':''}" onclick="(${onPage.toString()})(${p})">${p+1}</button>`;
    prev=p;
  });
  html+=`<button class="page-btn" ${current>=pages-1?'disabled':''} onclick="(${onPage.toString()})(${current+1})">Next →</button>`;
  el.innerHTML=html;
}

/* ══════════════════════════════════════════════════
   UTILITY
══════════════════════════════════════════════════ */
function debounce(fn,ms){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};}
function val(id){const el=document.getElementById(id);return el?el.value:'';}
function bindEvent(id,ev,fn){const el=document.getElementById(id);if(el&&!el[`_${ev}`]){el[`_${ev}`]=true;el.addEventListener(ev,fn);}}
function populateSelect(id,opts){const el=document.getElementById(id);if(!el||el.children.length>1)return;opts.forEach(o=>{const x=document.createElement('option');x.value=o;x.textContent=o;el.appendChild(x);});}

/* ── Entry point ── */
function initExplorer() { initGlobalSearch(); }
