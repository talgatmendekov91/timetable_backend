// src/routes/publicScheduleRoute.js  v3 — rewrite
const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const endTime = (start, dur) => {
  const [h, m] = (start || '0:0').split(':').map(Number);
  const mins   = (parseInt(dur) || 1) * 40;
  const total  = h * 60 + m + mins;
  return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
};

const TYPE_STYLE = {
  lecture: { bg:'#dbeafe', border:'#3b82f6', label:'Lecture' },
  lab:     { bg:'#dcfce7', border:'#22c55e', label:'Lab'     },
  seminar: { bg:'#fef3c7', border:'#f59e0b', label:'Seminar' },
};
const getStyle = (t) => TYPE_STYLE[t] || { bg:'#f1f5f9', border:'#94a3b8', label:'' };

const getDept = (g) => (g || '').split(/[-_\d]/)[0].trim().toUpperCase() || 'OTHER';

// ── CSS shared by all pages ───────────────────────────────────────────────
const CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Outfit',system-ui,sans-serif;background:#f0f4f8;color:#0f172a;min-height:100vh}
  a{color:inherit;text-decoration:none}
  .nav{background:linear-gradient(135deg,#0f172a,#1e1b4b);padding:0 24px;display:flex;align-items:center;gap:12px;height:54px;position:sticky;top:0;z-index:100;box-shadow:0 2px 12px rgba(0,0,0,.3)}
  .nav-logo{font-size:1rem;font-weight:900;color:#fff;display:flex;align-items:center;gap:8px}
  .nav-pill{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:.6rem;font-weight:800;padding:2px 8px;border-radius:99px}
  .nav-sp{flex:1}
  .nav-link{color:#94a3b8;font-size:.8rem;font-weight:600;padding:6px 12px;border-radius:8px;transition:background .14s}
  .nav-link:hover{background:rgba(255,255,255,.1);color:#fff}
  .page{max-width:900px;margin:0 auto;padding:24px 16px 60px}
  .crumb{font-size:.72rem;color:#94a3b8;margin-bottom:10px}
  .crumb a{color:#6366f1}
  .crumb a:hover{text-decoration:underline}
  .ph-title{font-size:1.5rem;font-weight:900;margin-bottom:4px}
  .ph-sub{font-size:.82rem;color:#64748b}
  .ph{margin-bottom:20px}
  /* Index */
  .search{width:100%;padding:10px 16px;border:1.5px solid #e2e8f0;border-radius:12px;font-size:.9rem;font-family:inherit;outline:none;background:#fff;margin-bottom:20px}
  .search:focus{border-color:#6366f1}
  .dept-title{font-size:.68rem;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;padding-bottom:5px;border-bottom:2px solid #e2e8f0}
  .dept{margin-bottom:28px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}
  .gcard{display:block;background:#fff;border:1.5px solid #e8ecf2;border-radius:12px;padding:14px 10px;text-align:center;font-weight:700;font-size:.88rem;color:#0f172a;transition:all .14s}
  .gcard:hover{border-color:#6366f1;background:#eef2ff;color:#4f46e5;transform:translateY(-2px);box-shadow:0 4px 16px rgba(99,102,241,.15)}
  .gcard-sub{font-size:.62rem;color:#94a3b8;font-weight:500;margin-top:3px}
  /* Schedule */
  .share-bar{background:#fff;border:1.5px solid #e8ecf2;border-radius:10px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .share-url{flex:1;font-size:.75rem;color:#6366f1;font-family:monospace;background:#eef2ff;padding:5px 10px;border-radius:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
  .share-copy{padding:6px 14px;background:#6366f1;color:#fff;border:none;border-radius:7px;font-size:.75rem;font-weight:700;cursor:pointer;white-space:nowrap}
  .tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
  .tab{padding:7px 18px;background:#fff;border:1.5px solid #e2e8f0;border-radius:99px;font-size:.8rem;font-weight:700;cursor:pointer;transition:all .14s;font-family:inherit;color:#475569}
  .tab:hover{border-color:#6366f1;color:#4f46e5}
  .tab.active{background:#6366f1;color:#fff;border-color:#6366f1}
  .panel{display:none}
  .panel.visible{display:block}
  table{width:100%;border-collapse:collapse;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.06)}
  th{background:#1e293b;color:#fff;padding:10px 14px;font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;font-weight:700;text-align:left}
  td{padding:0;border-bottom:1px solid #f1f5f9;vertical-align:top}
  tr:last-child td{border-bottom:none}
  .tc{padding:10px 14px;font-size:.78rem;font-weight:700;color:#64748b;white-space:nowrap;width:80px;background:#f8fafc;border-right:1px solid #f1f5f9}
  .tc-end{font-size:.62rem;color:#94a3b8;margin-top:2px}
  .cc{padding:8px 10px}
  .cb{padding:8px 10px;border-radius:8px;border-left:3px solid;position:relative}
  .cn{font-size:.85rem;font-weight:800;color:#0f172a;margin-bottom:2px}
  .cm{font-size:.72rem;color:#64748b;display:flex;flex-wrap:wrap;gap:8px;margin-top:3px}
  .badge{font-size:.58rem;font-weight:700;padding:1px 7px;border-radius:99px;position:absolute;top:6px;right:6px;color:#fff}
  /* Mobile */
  @media(max-width:650px){
    table{display:none}
    .mob{display:flex;flex-direction:column;gap:8px}
    .ms{background:#fff;border:1.5px solid #e8ecf2;border-radius:12px;overflow:hidden;display:flex}
    .mt{background:#1e293b;color:#fff;padding:10px 8px;font-size:.72rem;font-weight:800;display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:56px;gap:1px}
    .mt-e{color:#64748b;font-size:.6rem}
    .mc{padding:10px 12px;flex:1;border-left:3px solid}
  }
  @media(min-width:651px){.mob{display:none}}
  .footer{text-align:center;padding:32px 0 16px;color:#94a3b8;font-size:.72rem}
  .footer strong{color:#6366f1}
  .empty{text-align:center;padding:48px;color:#94a3b8}
`;

// ── HTML shell ─────────────────────────────────────────────────────────────
const page = (title, body) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title} — Alatoo Schedule</title>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>
<style>${CSS}</style>
</head>
<body>
<nav class="nav">
  <a class="nav-logo" href="/schedule">🏛 Alatoo <span class="nav-pill">Schedule</span></a>
  <div class="nav-sp"></div>
  <a class="nav-link" href="/schedule">All Groups</a>
</nav>
<div class="page">${body}</div>
<footer class="footer"><strong>Alatoo International University</strong> · Bishkek · Schedule is always up to date</footer>
</body>
</html>`;

// ── GET /schedule/debug/:group ─────────────────────────────────────────────
router.get('/debug/:group', async (req, res) => {
  const g = decodeURIComponent(req.params.group);
  try {
    const r = await pool.query(
      'SELECT day,time,course,teacher,room,subject_type,duration FROM schedules WHERE group_name=$1 ORDER BY day,time',
      [g]
    );
    res.json({
      group: g, count: r.rows.length,
      days:  [...new Set(r.rows.map(x => x.day))],
      times: [...new Set(r.rows.map(x => x.time))].sort(),
      sample: r.rows.slice(0,3),
    });
  } catch(e) { res.json({error:e.message}); }
});

// ── GET /schedule ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const [gRes, cRes] = await Promise.all([
      pool.query('SELECT name AS group_name FROM groups ORDER BY name'),
      pool.query('SELECT group_name, COUNT(*) AS cnt FROM schedules GROUP BY group_name'),
    ]);
    const counts = {};
    cRes.rows.forEach(r => { counts[r.group_name] = parseInt(r.cnt); });

    const depts = {};
    gRes.rows.forEach(({group_name: g}) => {
      const d = getDept(g);
      if (!depts[d]) depts[d] = [];
      depts[d].push(g);
    });

    const sections = Object.entries(depts).sort(([a],[b]) => a.localeCompare(b)).map(([d, gs]) => `
      <div class="dept" data-dept="${d}">
        <div class="dept-title">${d} &mdash; ${gs.length} group${gs.length>1?'s':''}</div>
        <div class="grid">
          ${gs.map(g => `
            <a class="gcard" href="/schedule/${encodeURIComponent(g)}">
              ${g}
              ${counts[g] ? `<div class="gcard-sub">${counts[g]} classes/week</div>` : ''}
            </a>`).join('')}
        </div>
      </div>`).join('');

    const body = `
      <div class="ph">
        <div class="ph-title">📅 Class Schedule</div>
        <div class="ph-sub">Alatoo International University &mdash; ${gRes.rows.length} groups &mdash; select your group</div>
      </div>
      <input class="search" placeholder="🔍 Search group... (e.g. CS-22)" oninput="filterGroups(this.value)" />
      <div id="gc">${sections}</div>
      <script>
        function filterGroups(v) {
          v = v.toLowerCase();
          document.querySelectorAll('.gcard').forEach(c => {
            c.style.display = (!v || c.textContent.toLowerCase().includes(v)) ? '' : 'none';
          });
          document.querySelectorAll('.dept').forEach(d => {
            d.style.display = [...d.querySelectorAll('.gcard')].some(c=>c.style.display!=='none') ? '' : 'none';
          });
        }
      </script>`;

    res.send(page('All Groups', body));
  } catch(e) { res.status(500).send(`<pre>${e.message}</pre>`); }
});

// ── GET /schedule/:group ──────────────────────────────────────────────────
router.get('/:group', async (req, res) => {
  const groupName = decodeURIComponent(req.params.group);
  try {
    const result = await pool.query(
      'SELECT day,time,course,teacher,room,subject_type,duration FROM schedules WHERE group_name=$1 ORDER BY day,time',
      [groupName]
    );

    if (result.rows.length === 0) {
      return res.status(404).send(page('Not Found', `
        <div class="crumb"><a href="/schedule">← All Groups</a></div>
        <div class="ph"><div class="ph-title">Group not found</div>
        <div class="ph-sub">No schedule found for "${groupName}"</div></div>
        <a href="/schedule" style="color:#6366f1;font-weight:700">← Back</a>`));
    }

    // Group rows by day
    const byDay = {};
    DAYS.forEach(d => { byDay[d] = []; });
    result.rows.forEach(row => {
      if (!byDay[row.day]) byDay[row.day] = [];
      byDay[row.day].push(row);
    });

    const activeDays = DAYS.filter(d => byDay[d].length > 0);

    // Build tab buttons HTML
    const tabsHtml = activeDays.map((d, i) =>
      `<button class="tab${i===0?' active':''}" data-day="${d}">${d.slice(0,3)}</button>`
    ).join('');

    // Build panels HTML — first one has class "visible"
    const panelsHtml = activeDays.map((day, i) => {
      const rows = byDay[day].sort((a,b) => {
        const [ah,am] = a.time.split(':').map(Number);
        const [bh,bm] = b.time.split(':').map(Number);
        return (ah*60+am)-(bh*60+bm);
      });

      const trs = rows.map(e => {
        const s = getStyle(e.subject_type);
        return `<tr>
          <td class="tc">${e.time}<div class="tc-end">${endTime(e.time,e.duration)}</div></td>
          <td class="cc"><div class="cb" style="background:${s.bg};border-left-color:${s.border}">
            ${s.label ? `<span class="badge" style="background:${s.border}">${s.label}</span>` : ''}
            <div class="cn">${e.course||'—'}</div>
            <div class="cm">
              ${e.teacher?`<span>👨‍🏫 ${e.teacher}</span>`:''}
              ${e.room?`<span>🚪 ${e.room}</span>`:''}
            </div>
          </div></td>
        </tr>`;
      }).join('');

      const mobs = rows.map(e => {
        const s = getStyle(e.subject_type);
        return `<div class="ms">
          <div class="mt">${e.time}<span class="mt-e">${endTime(e.time,e.duration)}</span></div>
          <div class="mc" style="border-left-color:${s.border}">
            <div class="cn">${e.course||'—'}</div>
            <div class="cm">
              ${e.teacher?`<span>👨‍🏫 ${e.teacher}</span>`:''}
              ${e.room?`<span>🚪 ${e.room}</span>`:''}
            </div>
          </div>
        </div>`;
      }).join('');

      return `<div class="panel${i===0?' visible':''}" data-day="${day}">
        <table><thead><tr><th>Time</th><th>Class</th></tr></thead><tbody>${trs}</tbody></table>
        <div class="mob">${mobs}</div>
      </div>`;
    }).join('');

    const currentUrl = `${req.protocol}://${req.get('host')}/schedule/${encodeURIComponent(groupName)}`;

    const body = `
      <div class="crumb"><a href="/schedule">← All Groups</a></div>
      <div class="ph">
        <div class="ph-title">📅 ${groupName}</div>
        <div class="ph-sub">${result.rows.length} classes &mdash; ${activeDays.length} days per week</div>
      </div>
      <div class="share-bar">
        <span style="font-size:.75rem;font-weight:700;color:#64748b">🔗 Share:</span>
        <span class="share-url">${currentUrl}</span>
        <button class="share-copy" onclick="var b=this;navigator.clipboard.writeText('${currentUrl}').then(()=>{b.textContent='✓ Copied!';setTimeout(()=>b.textContent='Copy',2000)})">Copy</button>
      </div>
      <div class="tabs">${tabsHtml}</div>
      ${panelsHtml}
      <script>
        function switchDay(day) {
          document.querySelectorAll('.tab').forEach(function(b){ b.classList.remove('active'); });
          document.querySelectorAll('.panel').forEach(function(p){ p.classList.remove('visible'); });
          var panel = document.querySelector('.panel[data-day="' + day + '"]');
          if (panel) panel.classList.add('visible');
          var btn = document.querySelector('.tab[data-day="' + day + '"]');
          if (btn) btn.classList.add('active');
        }
        // Wire up tabs
        document.querySelectorAll('.tab').forEach(function(btn) {
          btn.addEventListener('click', function() {
            switchDay(btn.getAttribute('data-day'));
          });
        });
        // Auto-switch to today if available
        var dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        var today = dayNames[new Date().getDay()];
        var todayBtn = document.querySelector('.tab[data-day="' + today + '"]');
        if (todayBtn) { switchDay(today); } 
      </script>`;

    res.send(page(groupName + ' Schedule', body));
  } catch(e) { res.status(500).send(`<pre>${e.message}</pre>`); }
});

module.exports = router;