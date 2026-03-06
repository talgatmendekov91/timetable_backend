// src/routes/publicScheduleRoute.js
// Serves standalone HTML pages — no login needed
// Routes:
//   GET /schedule              → index: list all groups
//   GET /schedule/:group       → group timetable
//   GET /schedule/dept/:dept   → department filter

const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
// TIME_SLOTS derived dynamically from actual DB data — no hardcoding needed

// ── Helpers ───────────────────────────────────────────────────────────────
const endTime = (start, dur) => {
  const [h, m] = start.split(':').map(Number);
  // duration in DB = number of 40-min slots (usually 1 = 40min, 2 = 80min)
  const mins  = (parseInt(dur) || 1) * 40;
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
};

const TYPE_COLORS = {
  lecture: { bg:'#dbeafe', border:'#3b82f6', text:'#1e40af', label:'Lecture' },
  lab:     { bg:'#dcfce7', border:'#22c55e', text:'#166534', label:'Lab'     },
  seminar: { bg:'#fef3c7', border:'#f59e0b', text:'#92400e', label:'Seminar' },
  default: { bg:'#f1f5f9', border:'#94a3b8', text:'#475569', label:''        },
};

const getColor = (type) => TYPE_COLORS[type] || TYPE_COLORS.default;

// Dept guessed from group name prefix (e.g. "CS-22" → "CS")
const getDept = (group) => (group || '').split(/[-_\d]/)[0].trim().toUpperCase();

// ── Shared HTML shell ─────────────────────────────────────────────────────
const shell = (title, bodyContent, extraHead = '') => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title} — Alatoo Schedule</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
  ${extraHead}
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Outfit',sans-serif;background:#f0f4f8;color:#0f172a;min-height:100vh}

    /* Nav */
    .nav{background:linear-gradient(135deg,#0f172a,#1e1b4b);padding:0 24px;display:flex;align-items:center;gap:16px;height:56px;position:sticky;top:0;z-index:100;box-shadow:0 2px 12px rgba(0,0,0,.3)}
    .nav-logo{font-size:1.1rem;font-weight:900;color:#fff;text-decoration:none;display:flex;align-items:center;gap:8px}
    .nav-badge{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:.65rem;font-weight:800;padding:2px 8px;border-radius:99px}
    .nav-spacer{flex:1}
    .nav-link{color:#94a3b8;text-decoration:none;font-size:.8rem;font-weight:600;padding:6px 12px;border-radius:8px;transition:all .14s}
    .nav-link:hover{background:rgba(255,255,255,.1);color:#fff}

    /* Page wrapper */
    .page{max-width:1100px;margin:0 auto;padding:24px 16px 60px}

    /* Page header */
    .page-header{margin-bottom:20px}
    .page-title{font-size:1.6rem;font-weight:900;color:#0f172a}
    .page-sub{font-size:.85rem;color:#64748b;margin-top:4px}
    .breadcrumb{font-size:.75rem;color:#94a3b8;margin-bottom:8px}
    .breadcrumb a{color:#6366f1;text-decoration:none}
    .breadcrumb a:hover{text-decoration:underline}

    /* ── Index page ── */
    .dept-section{margin-bottom:32px}
    .dept-title{font-size:.7rem;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #e2e8f0}
    .group-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px}
    .group-card{background:#fff;border:1.5px solid #e8ecf2;border-radius:12px;padding:14px 12px;text-align:center;text-decoration:none;color:#0f172a;font-weight:700;font-size:.9rem;transition:all .14s;display:block}
    .group-card:hover{border-color:#6366f1;background:#eef2ff;color:#4f46e5;transform:translateY(-2px);box-shadow:0 4px 16px rgba(99,102,241,.15)}

    /* Search */
    .search-wrap{margin-bottom:20px}
    .search-input{width:100%;padding:10px 16px;border:1.5px solid #e2e8f0;border-radius:12px;font-size:.9rem;font-family:inherit;outline:none;background:#fff;transition:border-color .14s}
    .search-input:focus{border-color:#6366f1}

    /* ── Schedule table ── */
    .day-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px}
    .day-tab{padding:7px 16px;background:#fff;border:1.5px solid #e2e8f0;border-radius:99px;font-size:.8rem;font-weight:700;cursor:pointer;transition:all .14s;font-family:inherit}
    .day-tab:hover{border-color:#6366f1;color:#4f46e5}
    .day-tab.active{background:#6366f1;color:#fff;border-color:#6366f1}

    .schedule-table{width:100%;border-collapse:collapse;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.06)}
    .schedule-table th{background:#1e293b;color:#fff;padding:10px 14px;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;font-weight:700;text-align:left}
    .schedule-table td{padding:0;border-bottom:1px solid #f1f5f9;vertical-align:top}
    .schedule-table tr:last-child td{border-bottom:none}
    .time-cell{padding:12px 14px;font-size:.8rem;font-weight:700;color:#64748b;white-space:nowrap;width:90px;background:#f8fafc;border-right:1px solid #f1f5f9}

    .class-cell{padding:8px 10px;min-height:56px}
    .class-block{padding:8px 10px;border-radius:8px;border-left:3px solid;position:relative}
    .class-name{font-size:.85rem;font-weight:800;color:#0f172a;margin-bottom:3px}
    .class-meta{font-size:.72rem;color:#64748b;display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
    .class-meta span{display:flex;align-items:center;gap:3px}
    .class-badge{font-size:.6rem;font-weight:700;padding:1px 7px;border-radius:99px;position:absolute;top:6px;right:6px}
    .empty-cell{color:#e2e8f0;font-size:.7rem;padding:16px 10px;text-align:center}

    /* Mobile */
    .mobile-day-view{display:none}
    @media(max-width:700px){
      .schedule-table{display:none}
      .mobile-day-view{display:block}
      .mobile-slot{background:#fff;border:1.5px solid #e8ecf2;border-radius:12px;margin-bottom:8px;overflow:hidden;display:flex}
      .mobile-time{background:#1e293b;color:#fff;padding:12px 10px;font-size:.75rem;font-weight:800;display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:60px;gap:2px}
      .mobile-time-end{color:#64748b;font-size:.65rem}
      .mobile-content{padding:12px;flex:1}
      .mobile-empty{color:#94a3b8;font-size:.78rem}
    }

    /* Share bar */
    .share-bar{background:#fff;border:1.5px solid #e8ecf2;border-radius:12px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
    .share-url{flex:1;font-size:.78rem;color:#6366f1;font-family:monospace;background:#eef2ff;padding:6px 10px;border-radius:7px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .share-copy{padding:7px 14px;background:#6366f1;color:#fff;border:none;border-radius:8px;font-size:.78rem;font-weight:700;cursor:pointer;font-family:inherit;transition:opacity .14s}
    .share-copy:hover{opacity:.85}

    /* Footer */
    .footer{text-align:center;padding:32px 16px 16px;color:#94a3b8;font-size:.75rem}
    .footer strong{color:#6366f1}

    /* Loading */
    .loading{text-align:center;padding:60px;color:#94a3b8;font-size:.9rem}
  </style>
</head>
<body>
  <nav class="nav">
    <a class="nav-logo" href="/schedule">🏛 <span>Alatoo</span> <span class="nav-badge">Schedule</span></a>
    <div class="nav-spacer"></div>
    <a class="nav-link" href="/schedule">All Groups</a>
  </nav>
  <div class="page">
    ${bodyContent}
  </div>
  <footer class="footer">
    <strong>Alatoo International University</strong> · Bishkek, Kyrgyzstan · ${new Date().getFullYear()}
    <br/>Schedule updates automatically · <a href="/schedule" style="color:#6366f1">View all groups</a>
  </footer>
</body>
</html>`;

// ── GET /schedule — Group index ───────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const [groupsRes, schedRes] = await Promise.all([
      pool.query('SELECT name AS group_name FROM groups ORDER BY name'),
      pool.query('SELECT group_name, COUNT(*) as class_count FROM schedules GROUP BY group_name'),
    ]);

    const classCounts = {};
    schedRes.rows.forEach(r => { classCounts[r.group_name] = parseInt(r.class_count); });

    const groups = groupsRes.rows.map(r => r.group_name);

    // Group by department prefix
    const depts = {};
    groups.forEach(g => {
      const dept = getDept(g);
      if (!depts[dept]) depts[dept] = [];
      depts[dept].push(g);
    });

    const deptSections = Object.entries(depts).sort(([a],[b]) => a.localeCompare(b)).map(([dept, grps]) => `
      <div class="dept-section">
        <div class="dept-title">${dept} — ${grps.length} group${grps.length > 1 ? 's' : ''}</div>
        <div class="group-grid">
          ${grps.map(g => `
            <a class="group-card" href="/schedule/${encodeURIComponent(g)}">
              ${g}
              ${classCounts[g] ? `<div style="font-size:.65rem;color:#94a3b8;font-weight:500;margin-top:3px">${classCounts[g]} classes/week</div>` : ''}
            </a>
          `).join('')}
        </div>
      </div>
    `).join('');

    const body = `
      <div class="page-header">
        <div class="page-title">📅 Class Schedule</div>
        <div class="page-sub">Alatoo International University · ${groups.length} groups · Select your group to view the timetable</div>
      </div>
      <div class="search-wrap">
        <input class="search-input" id="search" placeholder="🔍 Search group... (e.g. CS-22, IE-23)" oninput="filterGroups(this.value)" />
      </div>
      <div id="groups-container">${deptSections}</div>
      <script>
        function filterGroups(val) {
          const v = val.toLowerCase();
          document.querySelectorAll('.group-card').forEach(card => {
            const show = !v || card.textContent.toLowerCase().includes(v);
            card.closest('.group-card').style.display = show ? '' : 'none';
          });
          document.querySelectorAll('.dept-section').forEach(sec => {
            const anyVisible = [...sec.querySelectorAll('.group-card')].some(c => c.style.display !== 'none');
            sec.style.display = anyVisible ? '' : 'none';
          });
        }
      </script>
    `;
    res.send(shell('All Groups', body));
  } catch (err) {
    res.status(500).send(`<pre>Error: ${err.message}</pre>`);
  }
});

// ── GET /schedule/debug/:group — raw JSON for debugging ──────────────────
router.get('/debug/:group', async (req, res) => {
  const groupName = decodeURIComponent(req.params.group);
  try {
    const result = await pool.query(
      'SELECT day, time, course, teacher, room, subject_type, duration FROM schedules WHERE group_name = $1 ORDER BY day, time',
      [groupName]
    );
    res.json({
      group: groupName,
      count: result.rows.length,
      sample: result.rows.slice(0, 5),
      days: [...new Set(result.rows.map(r => r.day))],
      times: [...new Set(result.rows.map(r => r.time))].sort(),
    });
  } catch (err) {
    res.json({ error: err.message });
  }
});

// ── GET /schedule/:group — Group timetable ────────────────────────────────
router.get('/:group', async (req, res) => {
  const groupName = decodeURIComponent(req.params.group);
  try {
    const result = await pool.query(
      `SELECT day, time, course, teacher, room, subject_type, duration
       FROM schedules WHERE group_name = $1 ORDER BY day, time`,
      [groupName]
    );

    if (result.rows.length === 0) {
      const body = `
        <div class="breadcrumb"><a href="/schedule">← All Groups</a></div>
        <div class="page-header">
          <div class="page-title">Group not found</div>
          <div class="page-sub">No schedule found for "${groupName}"</div>
        </div>
        <a href="/schedule" style="color:#6366f1;font-weight:700">← Back to all groups</a>
      `;
      return res.status(404).send(shell('Not Found', body));
    }

    // Build schedule map: day → time → entry
    const schedMap = {};
    DAYS.forEach(d => { schedMap[d] = {}; });
    result.rows.forEach(row => {
      if (!schedMap[row.day]) schedMap[row.day] = {};
      schedMap[row.day][row.time] = row;
    });

    // Find active days
    const activeDays = DAYS.filter(d => Object.keys(schedMap[d] || {}).length > 0);
    console.log(`[PublicSchedule] ${groupName}: ${result.rows.length} rows, activeDays: ${JSON.stringify(activeDays)}, sampleDays: ${JSON.stringify([...new Set(result.rows.map(r=>r.day))])}`);

    // Render day tab content
    const dayTables = DAYS.map(day => {
      const daySlots = schedMap[day] || {};
      // Use actual times from DB, sorted chronologically
      const activeSlots = Object.keys(daySlots).sort((a, b) => {
        const [ah, am] = a.split(':').map(Number);
        const [bh, bm] = b.split(':').map(Number);
        return (ah * 60 + am) - (bh * 60 + bm);
      });
      if (activeSlots.length === 0) return '';

      const tableRows = activeSlots.map(time => {
        const e   = daySlots[time];
        const col = getColor(e.subject_type);
        return `
          <tr>
            <td class="time-cell">
              ${time}
              <div style="font-size:.65rem;color:#94a3b8;margin-top:2px">${endTime(time, e.duration)}</div>
            </td>
            <td class="class-cell">
              <div class="class-block" style="background:${col.bg};border-left-color:${col.border}">
                ${col.label ? `<span class="class-badge" style="background:${col.border};color:#fff">${col.label}</span>` : ''}
                <div class="class-name">${e.course || '—'}</div>
                <div class="class-meta">
                  ${e.teacher ? `<span>👨‍🏫 ${e.teacher}</span>` : ''}
                  ${e.room    ? `<span>🚪 ${e.room}</span>`    : ''}
                </div>
              </div>
            </td>
          </tr>`;
      }).join('');

      const mobileSlots = activeSlots.map(time => {
        const e   = daySlots[time];
        const col = getColor(e.subject_type);
        return `
          <div class="mobile-slot">
            <div class="mobile-time">
              <span>${time}</span>
              <span class="mobile-time-end">${endTime(time, e.duration)}</span>
            </div>
            <div class="mobile-content" style="border-left:3px solid ${col.border}">
              <div class="class-name">${e.course || '—'}</div>
              <div class="class-meta">
                ${e.teacher ? `<span>👨‍🏫 ${e.teacher}</span>` : ''}
                ${e.room    ? `<span>🚪 ${e.room}</span>` : ''}
              </div>
            </div>
          </div>`;
      }).join('');

      return `
        <div class="day-panel" id="day-${day}" style="display:none">
          <table class="schedule-table">
            <thead><tr><th>Time</th><th>Class</th></tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
          <div class="mobile-day-view">${mobileSlots}</div>
        </div>`;
    }).join('');

    const dayTabButtons = activeDays.map((day, i) =>
      `<button class="day-tab${i === 0 ? ' active' : ''}" onclick="switchDay('${day}')">${day.slice(0,3)}</button>`
    ).join('');

    const currentUrl = `${req.protocol}://${req.get('host')}/schedule/${encodeURIComponent(groupName)}`;
    const totalClasses = result.rows.length;
    const workDays = activeDays.length;

    const body = `
      <div class="breadcrumb"><a href="/schedule">← All Groups</a></div>
      <div class="page-header">
        <div class="page-title">📅 ${groupName}</div>
        <div class="page-sub">${totalClasses} classes · ${workDays} day${workDays !== 1 ? 's' : ''} per week</div>
      </div>

      <div class="share-bar">
        <span style="font-size:.78rem;font-weight:700;color:#64748b">🔗 Shareable link:</span>
        <span class="share-url">${currentUrl}</span>
        <button class="share-copy" onclick="copyLink('${currentUrl}', this)">Copy Link</button>
      </div>

      <div class="day-tabs">${dayTabButtons}</div>
      ${dayTables}

      <script>
        const activeDays = ${JSON.stringify(activeDays)};

        function switchDay(day) {
          document.querySelectorAll('.day-panel').forEach(p => p.style.display = 'none');
          document.querySelectorAll('.day-tab').forEach(b => b.classList.remove('active'));
          const panel = document.getElementById('day-' + day);
          if (panel) panel.style.display = 'block';
          event.target.classList.add('active');
        }

        function copyLink(url, btn) {
          navigator.clipboard.writeText(url).then(() => {
            btn.textContent = '✓ Copied!';
            setTimeout(() => btn.textContent = 'Copy Link', 2000);
          });
        }

        // Show today's day or first active day
        const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const today    = dayNames[new Date().getDay()];
        const showDay  = activeDays.includes(today) ? today : activeDays[0];
        if (showDay) {
          document.querySelectorAll('.day-panel').forEach(p => p.style.display = 'none');
          const panel = document.getElementById('day-' + showDay);
          if (panel) panel.style.display = 'block';
          document.querySelectorAll('.day-tab').forEach(b => {
            b.classList.toggle('active', b.textContent === showDay.slice(0,3));
          });
        } else if (activeDays.length > 0) {
          document.getElementById('day-' + activeDays[0]).style.display = 'block';
        }
      </script>
    `;

    res.send(shell(`${groupName} Schedule`, body));
  } catch (err) {
    res.status(500).send(`<pre>Error: ${err.message}</pre>`);
  }
});

module.exports = router;