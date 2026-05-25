// QueueOS Dashboard — polling client (sem framework)

const POLL_FAST = 2000;
const POLL_SLOW = 10000;

const $ = (id) => document.getElementById(id);

// ----- Tenant atual (persistido em localStorage) -----
let currentTenant = localStorage.getItem('queueos:tenant') || 'default';

function getTenantHeaders() {
  return { 'X-Tenant-Id': currentTenant };
}

async function fetchJson(url) {
  const r = await fetch(url, { headers: getTenantHeaders() });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
}

async function postJson(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getTenantHeaders() },
    body: JSON.stringify(body ?? {}),
  });
  return r.json();
}

async function deleteJson(url, body) {
  const r = await fetch(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...getTenantHeaders() },
    body: JSON.stringify(body ?? {}),
  });
  return r.json();
}

// input de tenant
document.addEventListener('DOMContentLoaded', () => {
  const inp = $('tenant-input');
  if (inp) {
    inp.value = currentTenant;
    inp.addEventListener('change', () => {
      currentTenant = inp.value.trim() || 'default';
      localStorage.setItem('queueos:tenant', currentTenant);
      tickFast();
      tickSlow();
    });
  }

  const form = $('cron-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const queue = $('cron-queue').value;
      const pattern = $('cron-pattern').value;
      const raw = $('cron-payload').value.trim();
      let payload = {};
      if (raw) {
        try { payload = JSON.parse(raw); }
        catch { alert('payload must be valid JSON'); return; }
      }
      const r = await postJson('/api/cron', { queue, pattern, payload });
      if (r.ok) {
        $('cron-pattern').value = '';
        $('cron-payload').value = '';
        updateCron();
      } else {
        alert('error: ' + (r.error ?? 'unknown'));
      }
    });
  }
});

function setStatus(ok) {
  const el = $('status');
  if (ok) {
    el.textContent = '● online';
    el.style.color = 'var(--green)';
  } else {
    el.textContent = '● offline';
    el.style.color = 'var(--red)';
  }
}

// ============================================
// Cards de métricas
// ============================================
async function updateMetrics() {
  try {
    const m = await fetchJson('/api/metrics');
    $('m-perMin').textContent = m.jobsPerMin;
    $('m-completed').textContent = m.completed.toLocaleString('en-US');
    $('m-avg').textContent = m.avgDurationMs;
    $('m-failed').textContent = m.failed.toLocaleString('en-US');
    $('m-success').textContent = m.successRate + '%';
    setStatus(true);
  } catch {
    setStatus(false);
  }
}

// ============================================
// Filas
// ============================================
async function toggleQueue(name, paused) {
  const action = paused ? 'resume' : 'pause';
  await fetch(`/api/queues/${name}/${action}`, { method: 'POST', headers: getTenantHeaders() });
  updateQueues();
}
window.toggleQueue = toggleQueue;

async function deleteCron(queue, key) {
  if (!confirm('Remove this cron job?')) return;
  await deleteJson('/api/cron', { queue, key });
  updateCron();
}
window.deleteCron = deleteCron;

async function updateCron() {
  try {
    const { jobs } = await fetchJson('/api/cron');
    const body = $('cron-body');
    if (!body) return;
    if (jobs.length === 0) {
      body.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:16px;">no cron jobs scheduled</td></tr>`;
      return;
    }
    body.innerHTML = jobs
      .map(
        (j) => `
      <tr>
        <td>${j.queue}</td>
        <td><code>${j.pattern ?? '—'}</code></td>
        <td>${j.next ? new Date(j.next).toLocaleString('en-US') : '—'}</td>
        <td><button class="btn" onclick="deleteCron('${j.queue}', '${j.key.replace(/'/g, "\\'")}')">🗑 remove</button></td>
      </tr>`,
      )
      .join('');
  } catch (e) {
    console.error('cron', e);
  }
}

async function updateQueues() {
  try {
    const { queues } = await fetchJson('/api/queues');
    $('queues').innerHTML = queues
      .map(
        (q) => `
      <div class="queue-row">
        <div class="name">
          ${q.name}
          ${q.paused ? '<span class="pill yellow">paused</span>' : ''}
          <button class="btn" onclick="toggleQueue('${q.name}', ${q.paused})">
            ${q.paused ? '▶ resume' : '⏸ pause'}
          </button>
        </div>
        <div class="pills">
          <span class="pill yellow">wait: ${q.waiting}</span>
          <span class="pill cyan">active: ${q.active}</span>
          <span class="pill green">completed: ${q.completed}</span>
          <span class="pill red">failed: ${q.failed}</span>
          <span class="pill purple">delayed: ${q.delayed}</span>
        </div>
      </div>`,
      )
      .join('');
  } catch (e) {
    console.error('queues', e);
  }
}

// ============================================
// Workers
// ============================================
async function updateWorkers() {
  try {
    const { workers } = await fetchJson('/api/workers');
    $('workers').innerHTML = workers
      .map(
        (w) => `
      <div class="worker-row">
        <div class="name">${w.name}</div>
        <div class="stats">
          <span>concurrency: <b>${w.concurrency}</b></span>
          <span>CPU: <b>${w.cpu}%</b></span>
          <span>RAM: <b>${w.memory} MB</b></span>
        </div>
      </div>`,
      )
      .join('');
  } catch (e) {
    console.error('workers', e);
  }
}

// ============================================
// Tabela de jobs recentes
// ============================================
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

async function updateJobs() {
  try {
    const { jobs } = await fetchJson('/api/jobs/recent');
    if (jobs.length === 0) {
      $('jobs-body').innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:20px;">no jobs yet</td></tr>`;
      return;
    }
    $('jobs-body').innerHTML = jobs
      .map(
        (j) => `
      <tr>
        <td>${j.queueName}</td>
        <td>#${j.jobId}</td>
        <td><span class="status-tag ${j.status}">${j.status}</span></td>
        <td>${j.durationMs} ms</td>
        <td>${j.attempts}</td>
        <td>${timeAgo(j.createdAt)}</td>
      </tr>`,
      )
      .join('');
  } catch (e) {
    console.error('jobs', e);
  }
}

// ============================================
// Throughput chart (SVG)
// ============================================
async function updateChart() {
  try {
    const { buckets } = await fetchJson('/api/throughput');
    const max = Math.max(...buckets, 1);
    const w = 600;
    const h = 160;
    const stepX = w / buckets.length;

    const points = buckets
      .map((v, i) => {
        const x = i * stepX + stepX / 2;
        const y = h - (v / max) * (h - 20) - 10;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    const bars = buckets
      .map((v, i) => {
        const x = i * stepX;
        const barH = (v / max) * (h - 20);
        const y = h - barH - 10;
        return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(stepX - 1).toFixed(1)}" height="${barH.toFixed(1)}" fill="rgba(34,211,238,0.15)" />`;
      })
      .join('');

    $('chart').innerHTML = `
      ${bars}
      <polyline points="${points}" fill="none" stroke="var(--cyan)" stroke-width="2" />
      <text x="8" y="14" fill="var(--muted)" font-size="10" font-family="monospace">max: ${max}/s</text>
    `;
  } catch (e) {
    console.error('chart', e);
  }
}

// ============================================
// Histórico chart (1h ou 24h)
// ============================================
let currentRange = '1h';

async function updateHistory() {
  try {
    const { range, buckets } = await fetchJson(`/api/metrics/history?range=${currentRange}`);
    const max = Math.max(...buckets.map((b) => b.completed + b.failed), 1);
    const w = 600;
    const h = 160;
    const stepX = w / buckets.length;

    const bars = buckets
      .map((b, i) => {
        const total = b.completed + b.failed;
        const x = i * stepX;
        const barH = (total / max) * (h - 30);
        const y = h - barH - 20;
        const failH = (b.failed / max) * (h - 30);
        const failY = h - failH - 20;
        return `
          <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(stepX - 1).toFixed(1)}" height="${barH.toFixed(1)}" fill="rgba(74,222,128,0.4)" />
          <rect x="${x.toFixed(1)}" y="${failY.toFixed(1)}" width="${(stepX - 1).toFixed(1)}" height="${failH.toFixed(1)}" fill="rgba(248,113,113,0.7)" />
        `;
      })
      .join('');

    const label = range === '24h' ? 'last 24h (by hour)' : 'last hour (by minute)';
    document.getElementById('history-chart').innerHTML = `
      ${bars}
      <text x="8" y="14" fill="var(--muted)" font-size="10" font-family="monospace">${label} • max: ${max}</text>
      <text x="${w - 8}" y="14" fill="var(--green)" font-size="10" font-family="monospace" text-anchor="end">■ completed  ■ failed</text>
    `;
  } catch (e) {
    console.error('history', e);
  }
}

document.getElementById('range-1h').addEventListener('click', () => {
  currentRange = '1h';
  updateHistory();
});
document.getElementById('range-24h').addEventListener('click', () => {
  currentRange = '24h';
  updateHistory();
});

// ============================================
// Loops de polling
// ============================================
async function tickFast() {
  await Promise.all([updateMetrics(), updateQueues(), updateJobs(), updateChart()]);
}
async function tickSlow() {
  await Promise.all([updateWorkers(), updateHistory(), updateCron()]);
}

tickFast();
tickSlow();
setInterval(tickFast, POLL_FAST);
setInterval(tickSlow, POLL_SLOW);
