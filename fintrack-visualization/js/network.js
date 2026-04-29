/* ═══════════════════════════════════════════════════════
   OpenClaw Network Graph — D3.js Force-Directed Graph
   Shows relationships: Users ↔ Accounts ↔ Merchants
                        Users ↔ Services (subscriptions)
                        Users ↔ Tickets
═══════════════════════════════════════════════════════ */

class NetworkGraph {
  constructor(svgId, tooltipId) {
    this.svgEl = document.getElementById(svgId);
    this.tooltipEl = document.getElementById(tooltipId);
    this.simulation = null;
    this.allNodes = [];
    this.allLinks = [];
    this.activeTypes = new Set(['user', 'account', 'merchant', 'service']);

    this._width = 0;
    this._height = 0;
    this._zoom = null;
    this._g = null;
    this._initialized = false;
  }

  /* ─── Public entry point ─── */
  build(fintrackData, zendeskData, showTickets = false) {
    if (showTickets) this.activeTypes.add('ticket');
    this._deriveGraphData(fintrackData, zendeskData);
    this._setup();
  }

  /* ─── Derive nodes & edges from raw data ─── */
  _deriveGraphData(ftData, zdData) {
    const { users, accounts, transactions, subscriptions } = ftData;

    /* Sample 28 users for readability */
    const sampleUsers = users.slice(0, 28);
    const sampleUserIds = new Set(sampleUsers.map(u => u.user_id));

    /* ─ Nodes ─ */
    const nodes = [];
    const nodeMap = {};

    const addNode = (id, type, label, meta = {}) => {
      if (!nodeMap[id]) {
        const n = { id, type, label, meta };
        nodes.push(n);
        nodeMap[id] = n;
      }
      return nodeMap[id];
    };

    /* Users */
    sampleUsers.forEach(u => {
      addNode(u.user_id, 'user', u.name, {
        email: u.email,
        since: u.member_since,
        accounts: u.linked_accounts_count
      });
    });

    /* Accounts for sampled users */
    const sampleAccounts = accounts.filter(a => sampleUserIds.has(a.user_id));
    sampleAccounts.forEach(a => {
      addNode(a.account_id, 'account', `${a.institution_name}\n(${a.account_type})`, {
        institution: a.institution_name,
        type: a.account_type,
        balance: a.balance,
        last4: a.last_four
      });
    });

    /* Top 16 merchants by absolute transaction volume */
    const merchantVol = {};
    transactions.forEach(t => {
      if (!merchantVol[t.merchant]) merchantVol[t.merchant] = { count: 0, total: 0 };
      merchantVol[t.merchant].count++;
      merchantVol[t.merchant].total += Math.abs(t.amount);
    });
    const topMerchants = Object.entries(merchantVol)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 16);
    topMerchants.forEach(([name, stats]) => {
      addNode('M_' + name, 'merchant', name, {
        txCount: stats.count,
        totalVol: stats.total.toFixed(0)
      });
    });
    const topMerchantSet = new Set(topMerchants.map(([n]) => n));

    /* Top 10 subscription services */
    const serviceCounts = {};
    subscriptions.forEach(s => {
      if (s.status === 'Active') {
        serviceCounts[s.service_name] = (serviceCounts[s.service_name] || 0) + 1;
      }
    });
    const topServices = Object.entries(serviceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    topServices.forEach(([name, count]) => {
      addNode('SVC_' + name, 'service', name, { subscribers: count });
    });
    const topServiceSet = new Set(topServices.map(([n]) => n));

    /* Support tickets for sampled users */
    const zdByExtId = {};
    (zdData.users || []).forEach(u => {
      if (u.external_id) zdByExtId[u.external_id] = u;
    });
    const zdTickets = (zdData.tickets || []).slice(0, 14);
    zdTickets.forEach(t => {
      addNode('TKT_' + t.id, 'ticket', `TKT${t.id}`, {
        subject: t.subject,
        status: t.status,
        created: t.created_at
      });
    });

    /* ─ Links ─ */
    const links = [];

    /* User → Account */
    sampleAccounts.forEach(a => {
      links.push({ source: a.user_id, target: a.account_id, type: 'has_account' });
    });

    /* Account → Merchant (sample 1-2 merchants per account to avoid hairball) */
    const accountTxMap = {};
    transactions.forEach(t => {
      if (!sampleUserIds.has(t.user_id)) return;
      if (!topMerchantSet.has(t.merchant)) return;
      const acctId = sampleAccounts.find(a =>
        a.user_id === t.user_id && a.last_four === t.account_last_four
      )?.account_id;
      if (!acctId) return;
      const key = `${acctId}_${t.merchant}`;
      if (!accountTxMap[key]) {
        accountTxMap[key] = true;
        links.push({ source: acctId, target: 'M_' + t.merchant, type: 'transacted_at' });
      }
    });

    /* User → Service (subscriptions) */
    const userServiceLinks = new Set();
    subscriptions.forEach(s => {
      if (!sampleUserIds.has(s.user_id)) return;
      if (!topServiceSet.has(s.service_name)) return;
      const key = `${s.user_id}_${s.service_name}`;
      if (!userServiceLinks.has(key)) {
        userServiceLinks.add(key);
        links.push({ source: s.user_id, target: 'SVC_' + s.service_name, type: 'subscribed_to' });
      }
    });

    /* User → Ticket (via zendesk external_id) */
    zdTickets.forEach(t => {
      const requester = (zdData.users || []).find(u => u.id === t.requester_id);
      if (requester?.external_id && sampleUserIds.has(requester.external_id)) {
        links.push({ source: requester.external_id, target: 'TKT_' + t.id, type: 'has_ticket' });
      }
    });

    this.allNodes = nodes;
    this.allLinks = links;
  }

  /* ─── D3 Setup ─── */
  _setup() {
    const svg = d3.select(this.svgEl);
    const container = this.svgEl.parentElement;
    this._width = container.clientWidth;
    this._height = container.clientHeight;

    svg.selectAll('*').remove();

    /* Zoom behaviour */
    this._zoom = d3.zoom()
      .scaleExtent([0.15, 4])
      .on('zoom', (e) => {
        this._g.attr('transform', e.transform);
      });
    svg.call(this._zoom);

    /* Main group */
    this._g = svg.append('g');

    /* Arrow markers */
    svg.append('defs').selectAll('marker')
      .data(['has_account', 'transacted_at', 'subscribed_to', 'has_ticket'])
      .join('marker')
        .attr('id', d => `arrow-${d}`)
        .attr('viewBox', '0 -4 8 8')
        .attr('refX', 18)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
      .append('path')
        .attr('d', 'M0,-4L8,0L0,4')
        .attr('fill', '#253556');

    this._draw();
    this._initialized = true;
  }

  _draw() {
    const visibleNodes = this.allNodes.filter(n => this.activeTypes.has(n.type));
    const visibleIds = new Set(visibleNodes.map(n => n.id));
    const visibleLinks = this.allLinks.filter(
      l => visibleIds.has(l.source.id || l.source) && visibleIds.has(l.target.id || l.target)
    );

    const g = this._g;
    g.selectAll('*').remove();

    const nodeColor = t => ({ user: '#818cf8', account: '#34d399', merchant: '#fbbf24', service: '#a78bfa', ticket: '#f87171' }[t] || '#94a3b8');
    const nodeRadius = n => ({ user: 10, account: 7, merchant: 9, service: 8, ticket: 7 }[n.type] || 7);

    /* Simulation */
    this.simulation = d3.forceSimulation(visibleNodes)
      .force('link', d3.forceLink(visibleLinks).id(d => d.id).distance(d => {
        const types = [d.source.type, d.target.type].join('-');
        if (types.includes('user') && types.includes('account')) return 70;
        if (types.includes('merchant')) return 100;
        if (types.includes('service')) return 90;
        return 80;
      }).strength(0.5))
      .force('charge', d3.forceManyBody().strength(-220))
      .force('center', d3.forceCenter(this._width / 2, this._height / 2))
      .force('collision', d3.forceCollide().radius(n => nodeRadius(n) + 12));

    /* Links */
    const link = g.append('g').attr('class', 'links').selectAll('line')
      .data(visibleLinks)
      .join('line')
        .attr('stroke', '#1e2d48')
        .attr('stroke-width', 1.2)
        .attr('stroke-opacity', 0.8)
        .attr('marker-end', d => `url(#arrow-${d.type})`);

    /* Node groups */
    const node = g.append('g').attr('class', 'nodes').selectAll('g')
      .data(visibleNodes)
      .join('g')
        .attr('class', 'node')
        .style('cursor', 'pointer')
        .call(d3.drag()
          .on('start', (e, d) => {
            if (!e.active) this.simulation.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
          .on('end', (e, d) => {
            if (!e.active) this.simulation.alphaTarget(0);
            d.fx = null; d.fy = null;
          })
        );

    /* Circles */
    node.append('circle')
      .attr('r', d => nodeRadius(d))
      .attr('fill', d => nodeColor(d.type))
      .attr('fill-opacity', 0.9)
      .attr('stroke', d => nodeColor(d.type))
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.3);

    /* Labels for larger nodes */
    node.append('text')
      .text(d => {
        const max = { user: 14, merchant: 16, service: 18, account: 14, ticket: 8 }[d.type] || 12;
        return d.label.split('\n')[0].slice(0, max);
      })
      .attr('dy', d => nodeRadius(d) + 11)
      .attr('text-anchor', 'middle')
      .attr('font-size', '9px')
      .attr('fill', '#94a3b8')
      .attr('pointer-events', 'none')
      .style('user-select', 'none');

    /* Hover interactions */
    const tooltip = this.tooltipEl;
    node
      .on('mouseover', (e, d) => {
        const color = nodeColor(d.type);
        let html = `<div class="tt-type" style="color:${color}">${d.type.toUpperCase()}</div>`;
        html += `<strong>${d.label.replace('\n', ' ')}</strong>`;
        if (d.meta) {
          if (d.meta.email)       html += `<div class="tt-row">✉ ${d.meta.email}</div>`;
          if (d.meta.since)       html += `<div class="tt-row">📅 Member since ${d.meta.since}</div>`;
          if (d.meta.accounts)    html += `<div class="tt-row">🏦 ${d.meta.accounts} linked accounts</div>`;
          if (d.meta.institution) html += `<div class="tt-row">🏛 ${d.meta.institution}</div>`;
          if (d.meta.type)        html += `<div class="tt-row">💳 ${d.meta.type}</div>`;
          if (d.meta.balance != null) html += `<div class="tt-row">💰 $${Number(d.meta.balance).toLocaleString()}</div>`;
          if (d.meta.txCount)     html += `<div class="tt-row">📊 ${d.meta.txCount} txns · $${Number(d.meta.totalVol).toLocaleString()}</div>`;
          if (d.meta.subscribers) html += `<div class="tt-row">👥 ${d.meta.subscribers} subscribers</div>`;
          if (d.meta.subject)     html += `<div class="tt-row">🎫 ${d.meta.subject.slice(0, 50)}</div>`;
        }
        tooltip.innerHTML = html;
        tooltip.classList.remove('hidden');
      })
      .on('mousemove', (e) => {
        const rect = this.svgEl.parentElement.getBoundingClientRect();
        let x = e.clientX - rect.left + 12;
        let y = e.clientY - rect.top + 12;
        if (x + 230 > rect.width) x -= 240;
        tooltip.style.left = x + 'px';
        tooltip.style.top  = y + 'px';
      })
      .on('mouseleave', () => {
        tooltip.classList.add('hidden');
      })
      /* Click: highlight connected nodes */
      .on('click', (e, d) => {
        e.stopPropagation();
        const connected = new Set([d.id]);
        visibleLinks.forEach(l => {
          const s = l.source.id || l.source;
          const t = l.target.id || l.target;
          if (s === d.id) connected.add(t);
          if (t === d.id) connected.add(s);
        });
        node.selectAll('circle')
          .attr('fill-opacity', n => connected.has(n.id) ? 1 : 0.15)
          .attr('stroke-opacity', n => connected.has(n.id) ? 0.7 : 0.05);
        link
          .attr('stroke-opacity', l => {
            const s = l.source.id || l.source;
            const t = l.target.id || l.target;
            return (s === d.id || t === d.id) ? 0.9 : 0.06;
          })
          .attr('stroke-width', l => {
            const s = l.source.id || l.source;
            const t = l.target.id || l.target;
            return (s === d.id || t === d.id) ? 2.5 : 0.8;
          });
      });

    /* Click background to deselect */
    d3.select(this.svgEl).on('click', () => {
      node.selectAll('circle').attr('fill-opacity', 0.9).attr('stroke-opacity', 0.3);
      link.attr('stroke-opacity', 0.8).attr('stroke-width', 1.2);
    });

    /* Tick */
    this.simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
  }

  /* ─── Update visible node types ─── */
  setTypes(types) {
    this.activeTypes = new Set(types);
    if (this._initialized) this._draw();
  }

  /* ─── Reset zoom ─── */
  resetZoom() {
    const svg = d3.select(this.svgEl);
    svg.transition().duration(500).call(
      this._zoom.transform,
      d3.zoomIdentity
    );
  }
}
