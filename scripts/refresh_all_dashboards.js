// ============================================================
// 焕梦测试招募问卷 — 三渠道数据大屏 刷新脚本
// 渠道: TapTap(362635200) | 主站(363467391) | 好游快爆(364883388)
// ============================================================

const fs = require('fs');
const { execSync } = require('child_process');

const CHANNELS = [
  { key: 'tap',    name: 'TapTap',   vid: '362635200' },
  { key: 'main',   name: '主站',      vid: '363467391' },
  { key: 'haoyou', name: '好游快爆',  vid: '364883388' },
];

const OUTPUT_HTML = 'D:\\claude\\index.html';
const DATA_DIR   = 'D:\\claude\\问卷数据';
const LOG_FILE   = 'D:\\claude\\问卷数据\\刷新日志_全渠道.md';
const REFRESH_MIN = 30;

const NOW = new Date();
const NOW_YEAR  = NOW.getFullYear();
const NOW_MONTH = NOW.getMonth() + 1;
const UPDATE_TIME = NOW.toLocaleString('zh-CN', { hour12: false });

// ======================== 工具函数 ========================
function parseCSVLine(line) {
  const r = []; let cur = '', inQ = false;
  for (const ch of line) { if (ch === '"') inQ = !inQ; else if (ch === ',' && !inQ) { r.push(cur); cur = ''; } else cur += ch; }
  r.push(cur); return r;
}
function parseSeconds(v) { if (!v) return null; const m = v.match(/^(\d+)\s*秒?$/); return m ? parseInt(m[1], 10) : null; }
function calcAge(birth) {
  if (!birth) return null; const m = birth.match(/^(\d{4})-(\d{2})$/); if (!m) return null;
  let age = NOW_YEAR - parseInt(m[1], 10); if (NOW_MONTH < parseInt(m[2], 10)) age--; return age;
}
function isValidPhone(s) { return s && /^1\d{10}$/.test(s.trim()); }
function isValidEmail(s) {
  if (!s || !s.trim()) return false; const at = s.indexOf('@');
  if (at <= 0 || at === s.length - 1) return false;
  const d = s.substring(at + 1); return d.includes('.') && d.indexOf('.') < d.length - 1;
}
function isValidId(s) { return s && /^\d+$/.test(s.trim()); }

// ======================== 下载 CSV ========================
function downloadCSV(vid, label) {
  const csvPath = `${DATA_DIR}\\焕梦_${label}_原始.csv`;
  const PAGE_SIZE = 3000;
  try {
    console.log(`  拉取 ${label} (vid=${vid})...`);
    // 先查总数
    let total = 0;
    try {
      const cntRes = JSON.parse(execSync(`wjx response count --vid ${vid} --json`, { encoding: 'utf-8', timeout: 30000 }));
      total = cntRes?.data?.join_times || cntRes?.data?.count || 0;
    } catch (e) { /* ignore */ }
    console.log(`    ${label}: 共 ${total} 份答卷`);

    if (total === 0) return { path: null, total: 0 };

    if (total <= PAGE_SIZE) {
      const res = JSON.parse(execSync(`wjx response download --vid ${vid} --suffix 0 --query_count ${total} --json`, { encoding: 'utf-8', timeout: 60000 }));
      if (!res.data?.download_url) throw new Error('无下载链接');
      execSync(`powershell -Command "Invoke-WebRequest -Uri '${res.data.download_url}' -OutFile '${csvPath}'"`, { timeout: 180000 });
    } else {
      // 分页下载并合并
      const pages = Math.ceil(total / PAGE_SIZE);
      const csvFiles = [];
      let headerLine = '';
      for (let p = 0; p < pages; p++) {
        const minIdx = p * PAGE_SIZE;
        const qCount = Math.min(PAGE_SIZE, total - minIdx);
        console.log(`    分页 ${p + 1}/${pages}: min_index=${minIdx}, count=${qCount}`);
        const res = JSON.parse(execSync(`wjx response download --vid ${vid} --suffix 0 --query_count ${qCount} --min_index ${minIdx} --json`, { encoding: 'utf-8', timeout: 60000 }));
        if (!res.data?.download_url) throw new Error(`分页${p+1}无下载链接`);
        const tmpPath = `${csvPath}.part${p}`;
        execSync(`powershell -Command "Invoke-WebRequest -Uri '${res.data.download_url}' -OutFile '${tmpPath}'"`, { timeout: 180000 });
        csvFiles.push(tmpPath);
        if (p === 0) {
          let raw = fs.readFileSync(tmpPath, 'utf-8');
          if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
          headerLine = raw.split('\n')[0];
        }
      }
      // 合并：header + 所有数据行
      const allLines = [headerLine];
      csvFiles.forEach(f => {
        let raw = fs.readFileSync(f, 'utf-8');
        if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
        const lines = raw.split('\n').filter(l => l.trim());
        for (let i = 1; i < lines.length; i++) allLines.push(lines[i]);
        fs.unlinkSync(f); // 删除临时文件
      });
      fs.writeFileSync(csvPath, '﻿' + allLines.join('\n'), 'utf-8');
    }
    console.log(`    ${label}: CSV 已保存`);
    return { path: csvPath, total };
  } catch (e) {
    console.error(`    ${label} 下载失败: ${e.message}, 尝试用已有文件`);
    if (fs.existsSync(csvPath)) {
      const raw = fs.readFileSync(csvPath, 'utf-8');
      const count = raw.split('\n').filter(l => l.trim()).length - 1;
      return { path: csvPath, total: count };
    }
    return { path: null, total: 0 };
  }
}

// ======================== 数据清洗 ========================
function cleanSurvey(csvPath, label) {
  if (!csvPath || !fs.existsSync(csvPath)) return null;

  let raw = fs.readFileSync(csvPath, 'utf-8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  const lines = raw.split('\n').filter(l => l.trim());
  const header = lines[0].split(',');

  const idx = {
    id:        header.findIndex(c => c.includes('账号ID') || c.includes('账户ID')),
    birth:     header.findIndex(c => c.includes('出生年月')),
    time:      header.findIndex(c => c.includes('所用时间')),
    processor: header.findIndex(c => c.includes('手机处理器')),
    ram:       header.findIndex(c => c.includes('运行内存')),
    os:        header.findIndex(c => c.includes('PC设备的系统版本')),
    trap:      header.findIndex(c => c.includes('18、')),
    phone:     header.findIndex(c => c.includes('手机号码')),
    email:     header.findIndex(c => c.includes('邮箱')),
  };

  const rules = [
    { key:'time_short', cat:'quality',  label:'答题过快(<60s)',    check: r => { const s = parseSeconds(r[idx.time]); return s !== null && s < 60; } },
    { key:'time_long',  cat:'quality',  label:'答题超时(>6000s)',  check: r => { const s = parseSeconds(r[idx.time]); return s !== null && s > 6000; } },
    { key:'trap',       cat:'quality',  label:'陷阱题(射击类)',    check: r => (r[idx.trap]||'').includes('射击类') },
    { key:'age',        cat:'identity', label:'年龄不符',          check: r => { const a = calcAge(r[idx.birth]); return a !== null && (a < 18 || a > 100); } },
    { key:'phone',      cat:'identity', label:'手机号错误',        check: r => !isValidPhone(r[idx.phone]) },
    { key:'email',      cat:'identity', label:'邮箱错误',          check: r => !isValidEmail(r[idx.email]) },
    { key:'id_err',     cat:'identity', label:'账号ID错误',        check: r => idx.id >= 0 && !isValidId(r[idx.id]) },
    { key:'q9',         cat:'device',   label:'Q9不清楚处理器',    check: r => (r[idx.processor]||'').startsWith('不清楚具体配置') },
    { key:'q10',        cat:'device',   label:'Q10不清楚内存',     check: r => (r[idx.ram]||'').trim() === '不清楚' },
    { key:'q11',        cat:'device',   label:'Q11其他OS',         check: r => { const v = (r[idx.os]||'').trim(); return v === '其他 Windows 系统' || v === '其他操作系统（如 Linux、鸿蒙）'; } },
  ];

  let total = 0, validCount = 0;
  const ruleHits = {}; rules.forEach(r => { ruleHits[r.key] = 0; });
  const catHits = { quality: 0, identity: 0, device: 0 };

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.length < 20) continue;
    total++;
    const failed = rules.filter(r => r.check(row)).map(r => r.key);
    if (failed.length === 0) { validCount++; }
    else {
      const cats = new Set();
      failed.forEach(k => { ruleHits[k]++; const rl = rules.find(r => r.key === k); if (rl) cats.add(rl.cat); });
      cats.forEach(c => { catHits[c]++; });
    }
  }

  return {
    total, valid: validCount, invalid: total - validCount,
    rate: total > 0 ? ((validCount / total) * 100).toFixed(1) : '0.0',
    ruleHits, catHits, updateTime: UPDATE_TIME,
  };
}

// ======================== 主流程 ========================
console.log('═'.repeat(60));
console.log('[1/3] 拉取三渠道数据...');
const downloads = CHANNELS.map(ch => ({ ...ch, csv: downloadCSV(ch.vid, ch.name) }));

console.log('\n[2/3] 执行数据清洗...');
const results = {};
downloads.forEach(ch => {
  const data = cleanSurvey(ch.csv?.path, ch.name);
  if (data) {
    results[ch.key] = data;
    console.log(`  ${ch.name}: ${data.total} → 有效${data.valid} / 无效${data.invalid} (${data.rate}%)`);
  }
});

console.log('\n[3/3] 生成三合一数据大屏...');
const html = generateCombinedHTML(results, REFRESH_MIN);
fs.writeFileSync(OUTPUT_HTML, html, 'utf-8');
console.log(`✅ 大屏已刷新: ${UPDATE_TIME}`);
console.log(`   文件: ${OUTPUT_HTML}`);

// 日志
const logEntry = `| ${UPDATE_TIME} | ${results.haoyou?.total||0} | ${results.haoyou?.valid||0} | ${results.tap?.total||0} | ${results.tap?.valid||0} | ${results.main?.total||0} | ${results.main?.valid||0} |\n`;
const logHeader = '| 刷新时间 | 好游快爆-原始 | 有效 | TapTap-原始 | 有效 | 主站-原始 | 有效 |\n|----------|-------------|------|------------|------|----------|------|\n';
if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, logHeader + logEntry, 'utf-8');
else fs.appendFileSync(LOG_FILE, logEntry, 'utf-8');

// ======================== HTML 模板 ========================
function generateCombinedHTML(data, intervalMin) {
  const chs = CHANNELS.map(ch => ({ ...ch, d: data[ch.key] }));
  const totalAll = chs.reduce((s, c) => s + (c.d?.total || 0), 0);
  const validAll = chs.reduce((s, c) => s + (c.d?.valid || 0), 0);
  const invalidAll = totalAll - validAll;
  const rateAll = totalAll > 0 ? ((validAll / totalAll) * 100).toFixed(1) : '0.0';

  const catColors = { quality: '#4fc3f7', identity: '#66bb6a', device: '#ffa726' };
  const green = '#66bb6a', red = '#ef5350', blue = '#4fc3f7', orange = '#ffa726';

  // 每个渠道的图表数据 JSON
  const chartsData = {};
  chs.forEach(ch => {
    if (!ch.d) return;
    chartsData[ch.key] = {
      total: ch.d.total, valid: ch.d.valid, invalid: ch.d.invalid, rate: ch.d.rate,
      ruleHits: ch.d.ruleHits, catHits: ch.d.catHits,
      name: ch.name,
      barRules: [
        { name:'答题过快(<60s)',   val:ch.d.ruleHits.time_short, color:catColors.quality },
        { name:'答题超时(>6000s)', val:ch.d.ruleHits.time_long,  color:catColors.quality },
        { name:'陷阱题(射击类)',   val:ch.d.ruleHits.trap,       color:catColors.quality },
        { name:'年龄不符',        val:ch.d.ruleHits.age,         color:catColors.identity },
        { name:'手机号错误',      val:ch.d.ruleHits.phone,       color:catColors.identity },
        { name:'邮箱错误',        val:ch.d.ruleHits.email,       color:catColors.identity },
        { name:'ID错误',          val:ch.d.ruleHits.id_err,      color:catColors.identity },
        { name:'Q9不清楚处理器',  val:ch.d.ruleHits.q9,          color:catColors.device },
        { name:'Q10不清楚内存',   val:ch.d.ruleHits.q10,         color:catColors.device },
        { name:'Q11其他OS',       val:ch.d.ruleHits.q11,         color:catColors.device },
      ]
    };
  });

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="refresh" content="${intervalMin * 60}">
<title>焕梦测试招募问卷 — 数据清洗大屏</title>
<script src="https://cdn.jsdelivr.net/npm/echarts@5.6.0/dist/echarts.min.js"></script>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Microsoft YaHei','PingFang SC',sans-serif; background:#0f1923; color:#e0e0e0; padding:16px; }
  .container { max-width:1320px; margin:0 auto; }

  /* Header */
  .header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px; }
  .header h1 { font-size:22px; color:#fff; }
  .live-badge { display:inline-flex; align-items:center; gap:6px; background:rgba(239,83,80,0.15); border:1px solid #ef5350; border-radius:20px; padding:5px 12px; }
  .live-dot { width:8px; height:8px; background:#ef5350; border-radius:50%; animation:pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
  .live-text { color:#ef5350; font-size:12px; font-weight:bold; }
  .update-info { font-size:11px; color:#8899aa; text-align:right; }
  .update-info .time { color:#fff; }
  .countdown { color:#ffa726; font-size:10px; }

  /* Tabs */
  .tabs { display:flex; gap:4px; margin-bottom:18px; background:#1a2a3a; border-radius:10px; padding:4px; }
  .tab { padding:10px 24px; border-radius:8px; cursor:pointer; font-size:14px; font-weight:bold; color:#8899aa; border:none; background:transparent; transition:all 0.2s; }
  .tab:hover { color:#ccc; background:rgba(255,255,255,0.05); }
  .tab.active { background:#4fc3f7; color:#000; }

  /* Cards */
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-bottom:18px; }
  .card { background:#1a2a3a; border-radius:10px; padding:14px; text-align:center; }
  .card .num { font-size:28px; font-weight:bold; }
  .card .label { font-size:11px; color:#8899aa; margin-top:2px; }
  .card.green .num { color:#66bb6a; }
  .card.red .num { color:#ef5350; }
  .card.blue .num { color:#4fc3f7; }
  .card.orange .num { color:#ffa726; }

  /* Rules */
  .rule-box { background:#1a2a3a; border-radius:10px; padding:14px; margin-bottom:16px; }
  .rule-box h3 { font-size:13px; margin-bottom:10px; color:#fff; }
  .cat-section { margin-bottom:10px; }
  .cat-title { font-size:11px; font-weight:bold; margin-bottom:5px; padding:2px 7px; display:inline-block; border-radius:4px; }
  .cat-title.quality { color:#4fc3f7; background:rgba(79,195,247,0.1); }
  .cat-title.identity { color:#66bb6a; background:rgba(102,187,106,0.1); }
  .cat-title.device { color:#ffa726; background:rgba(255,167,38,0.1); }
  .rule-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:5px; }
  .rule-item { display:flex; align-items:center; gap:5px; padding:6px 7px; background:#0f1923; border-radius:6px; border-left:3px solid #2a3a4a; font-size:10px; }
  .rule-item .hit { font-size:12px; font-weight:bold; white-space:nowrap; margin-left:auto; }
  .rule-item .hit.none { color:#667788; }

  /* Charts */
  .chart-row { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px; }
  .chart-row.triple { grid-template-columns:1fr 1fr 1fr; }
  .chart-box { background:#1a2a3a; border-radius:10px; padding:12px; }
  .chart-box.full { grid-column:1 / -1; }
  .chart-box h3 { font-size:12px; color:#ccc; margin-bottom:3px; }

  /* Overview cards row */
  .overview-channels { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:18px; }
  .ov-card { background:#1a2a3a; border-radius:10px; padding:16px; }
  .ov-card h3 { font-size:15px; margin-bottom:10px; }
  .ov-card .mini-cards { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .ov-card .mc { background:#0f1923; border-radius:8px; padding:10px; text-align:center; }
  .ov-card .mc .n { font-size:22px; font-weight:bold; }
  .ov-card .mc .l { font-size:10px; color:#8899aa; }

  .hidden { display:none !important; }

  @media (max-width:768px) {
    .rule-grid { grid-template-columns:1fr; }
    .chart-row, .chart-row.triple { grid-template-columns:1fr; }
    .overview-channels { grid-template-columns:1fr; }
    .tabs { flex-wrap:wrap; }
  }
</style>
</head>
<body>
<div class="container">
  <!-- Header -->
  <div class="header">
    <div style="display:flex;align-items:center;gap:10px;">
      <h1>🔬 焕梦测试招募问卷 · 数据清洗大屏</h1>
      <span class="live-badge"><span class="live-dot"></span><span class="live-text">LIVE</span></span>
    </div>
    <div class="update-info">
      <div>最后更新 <span class="time">${UPDATE_TIME}</span></div>
      <div class="countdown" id="countdown">下次刷新: 计算中...</div>
    </div>
  </div>

  <!-- Tabs -->
  <div class="tabs">
    <button class="tab active" onclick="switchTab('overview')">📊 总览</button>
    <button class="tab" onclick="switchTab('haoyou')">🎮 好游快爆</button>
    <button class="tab" onclick="switchTab('tap')">📱 TapTap</button>
    <button class="tab" onclick="switchTab('main')">🌐 主站</button>
  </div>

  <!-- ==================== 总览面板 ==================== -->
  <div id="panel-overview">
    <div class="cards">
      <div class="card blue"><div class="num">${totalAll.toLocaleString()}</div><div class="label">三渠道原始答卷总数</div></div>
      <div class="card green"><div class="num">${validAll.toLocaleString()}</div><div class="label">三渠道有效答卷</div></div>
      <div class="card red"><div class="num">${invalidAll.toLocaleString()}</div><div class="label">三渠道剔除无效</div></div>
      <div class="card orange"><div class="num">${rateAll}%</div><div class="label">总有效回收率</div></div>
    </div>

    <div class="overview-channels">
      ${chs.map(ch => {
        if (!ch.d) return '';
        const cq = ch.d.catHits.quality || 0, ci = ch.d.catHits.identity || 0, cd = ch.d.catHits.device || 0;
        const mc = catColors;
        return `<div class="ov-card">
          <h3 style="color:${mc.quality}">${ch.name}</h3>
          <div class="mini-cards">
            <div class="mc"><div class="n" style="color:#4fc3f7">${(ch.d.total||0).toLocaleString()}</div><div class="l">原始答卷</div></div>
            <div class="mc"><div class="n" style="color:#66bb6a">${(ch.d.valid||0).toLocaleString()}</div><div class="l">有效答卷</div></div>
            <div class="mc"><div class="n" style="color:#ef5350">${(ch.d.invalid||0).toLocaleString()}</div><div class="l">剔除无效</div></div>
            <div class="mc"><div class="n" style="color:#ffa726">${ch.d.rate}%</div><div class="l">有效率</div></div>
          </div>
        </div>`;
      }).join('')}
    </div>

    <div class="chart-row">
      <div class="chart-box full"><h3>三渠道对比 — 总览</h3><div id="ov-compare" style="height:340px;"></div></div>
    </div>
    <div class="chart-row triple">
      <div class="chart-box"><h3>答题质量低 命中对比</h3><div id="ov-quality" style="height:280px;"></div></div>
      <div class="chart-box"><h3>身份核验不符合要求 命中对比</h3><div id="ov-identity" style="height:280px;"></div></div>
      <div class="chart-box"><h3>设备甄别不符合要求 命中对比</h3><div id="ov-device" style="height:280px;"></div></div>
    </div>
  </div>

  <!-- ==================== 渠道详情面板 ==================== -->
  ${chs.map(ch => {
    if (!ch.d || !chartsData[ch.key]) return '';
    const cd = chartsData[ch.key];
    const dd = ch.d;
    return `<div id="panel-${ch.key}" class="hidden">
    <div class="cards">
      <div class="card blue"><div class="num">${dd.total.toLocaleString()}</div><div class="label">原始答卷总数</div></div>
      <div class="card green"><div class="num">${dd.valid.toLocaleString()}</div><div class="label">清洗后有效答卷</div></div>
      <div class="card red"><div class="num">${dd.invalid.toLocaleString()}</div><div class="label">剔除无效答卷</div></div>
      <div class="card orange"><div class="num">${dd.rate}%</div><div class="label">有效回收率</div></div>
    </div>

    <div class="rule-box">
      <h3>📋 清洗规则（3 类 × 10 条）</h3>
      <div class="cat-section">
        <span class="cat-title quality">🔵 一、答题质量</span>
        <div class="rule-grid">
          <div class="rule-item" style="border-left-color:#4fc3f7;"><span>答题过快</span><span style="font-size:9px;color:#8899aa;">&lt;60s</span><span class="hit" style="color:#81d4fa;">${dd.ruleHits.time_short}</span></div>
          <div class="rule-item" style="border-left-color:#4fc3f7;"><span>答题超时</span><span style="font-size:9px;color:#8899aa;">&gt;6000s</span><span class="hit" style="color:#81d4fa;">${dd.ruleHits.time_long}</span></div>
          <div class="rule-item" style="border-left-color:#4fc3f7;"><span>陷阱题</span><span style="font-size:9px;color:#8899aa;">Q18 射击类</span><span class="hit" style="color:#81d4fa;">${dd.ruleHits.trap}</span></div>
        </div>
      </div>
      <div class="cat-section">
        <span class="cat-title identity">🟢 二、身份核验</span>
        <div class="rule-grid" style="grid-template-columns:1fr 1fr 1fr 1fr;">
          <div class="rule-item" style="border-left-color:#66bb6a;"><span>年龄不符</span><span class="hit" style="color:#a5d6a7;">${dd.ruleHits.age}</span></div>
          <div class="rule-item" style="border-left-color:#66bb6a;"><span>手机号</span><span class="hit none">${dd.ruleHits.phone}</span></div>
          <div class="rule-item" style="border-left-color:#66bb6a;"><span>邮箱</span><span class="hit none">${dd.ruleHits.email}</span></div>
          <div class="rule-item" style="border-left-color:#66bb6a;"><span>ID错误</span><span class="hit" style="color:#a5d6a7;">${dd.ruleHits.id_err}</span></div>
        </div>
      </div>
      <div class="cat-section" style="margin-bottom:0;">
        <span class="cat-title device">🟠 三、设备甄别</span>
        <div class="rule-grid">
          <div class="rule-item" style="border-left-color:#ffa726;"><span>Q9不清楚处理器</span><span class="hit" style="color:#ffcc80;">${dd.ruleHits.q9}</span></div>
          <div class="rule-item" style="border-left-color:#ffa726;"><span>Q10不清楚内存</span><span class="hit" style="color:#ffcc80;">${dd.ruleHits.q10}</span></div>
          <div class="rule-item" style="border-left-color:#ffa726;"><span>Q11其他OS</span><span class="hit" style="color:#ffcc80;">${dd.ruleHits.q11}</span></div>
        </div>
      </div>
    </div>

    <div class="chart-row">
      <div class="chart-box"><h3>有效 vs 无效</h3><div id="pie-${ch.key}" style="height:300px;"></div></div>
      <div class="chart-box"><h3>各规则命中数</h3><div id="bar-${ch.key}" style="height:300px;"></div></div>
    </div>
    <div class="chart-row">
      <div class="chart-box"><h3>三类规则命中占比</h3><div id="cat-${ch.key}" style="height:300px;"></div></div>
      <div class="chart-box"><h3>数据流</h3><div id="sankey-${ch.key}" style="height:300px;"></div></div>
    </div>
  </div>`;
  }).join('')}
</div>

<script>
var DATA = ${JSON.stringify(chartsData)};
var CHS = ${JSON.stringify(chs.map(ch => ({ key:ch.key, name:ch.name })))};
var green='#66bb6a', red='#ef5350', blue='#4fc3f7', orange='#ffa726';
var catQuality='#4fc3f7', catIdentity='#66bb6a', catDevice='#ffa726';
var catColors = { quality: catQuality, identity: catIdentity, device: catDevice };
var refreshInterval = ${intervalMin};

// ====== Tab switch ======
function switchTab(key) {
  document.querySelectorAll('.tab').forEach(function(t){ t.classList.toggle('active', t.textContent.includes(key==='overview'?'总览':key==='haoyou'?'好游快爆':key==='tap'?'TapTap':'主站')); });
  ['overview','haoyou','tap','main'].forEach(function(k){
    var p = document.getElementById('panel-'+k);
    if (p) p.classList.toggle('hidden', k !== key);
  });
  if (key !== 'overview') { setTimeout(function(){ renderChannel(key); }, 100); }
}

// ====== Render overview charts ======
(function(){
  var chNames = CHS.map(function(c){return c.name;});
  var totals = CHS.map(function(c){return DATA[c.key]?DATA[c.key].total:0;});
  var valids = CHS.map(function(c){return DATA[c.key]?DATA[c.key].valid:0;});
  var invalids = CHS.map(function(c){return DATA[c.key]?DATA[c.key].invalid:0;});

  // Compare bar — 绝对数量对比
  var cv = echarts.init(document.getElementById('ov-compare'));
  cv.setOption({
    tooltip:{trigger:'axis',axisPointer:{type:'shadow'}},
    legend:{data:['有效','无效'],bottom:0,textStyle:{color:'#8899aa',fontSize:11}},
    grid:{left:2,right:8,bottom:28,top:8,containLabel:true},
    xAxis:{type:'category',data:chNames,axisLabel:{color:'#ccc',fontSize:11}},
    yAxis:{type:'value',axisLabel:{color:'#8899aa',fontSize:10},splitLine:{lineStyle:{color:'#1e3040'}}},
    series:[
      {name:'有效',type:'bar',barWidth:44,itemStyle:{color:green,borderRadius:[3,3,0,0]},
       data:CHS.map(function(ch){var d=DATA[ch.key];return d?d.valid:0;}),
       label:{show:true,position:'top',color:'#ccc',fontSize:10,formatter:function(p){return p.value.toLocaleString();}}},
      {name:'无效',type:'bar',barWidth:44,itemStyle:{color:red,borderRadius:[3,3,0,0]},
       data:CHS.map(function(ch){var d=DATA[ch.key];return d?d.invalid:0;}),
       label:{show:true,position:'top',color:'#ccc',fontSize:10,formatter:function(p){return p.value.toLocaleString();}}}
    ]
  });

  // Category comparison — 命中率百分比
  function catBar(id, catKey){
    var c = echarts.init(document.getElementById(id));
    c.setOption({
      tooltip:{trigger:'axis',axisPointer:{type:'shadow'},formatter:function(ps){var p=ps[0];return p.name+'<br/>命中率: '+p.value.toFixed(1)+'%';}},
      grid:{left:2,right:8,bottom:2,top:10,containLabel:true},
      xAxis:{type:'category',data:chNames,axisLabel:{color:'#ccc',fontSize:10}},
      yAxis:{type:'value',axisLabel:{color:'#8899aa',fontSize:9,formatter:'{value}%'},splitLine:{lineStyle:{color:'#1e3040'}}},
      series:[{type:'bar',barWidth:30,
        data:CHS.map(function(ch){
          var d=DATA[ch.key];
          var hits=d?d.catHits[catKey]:0, total=d?d.total:1;
          var pct=(hits/total*100);
          return {value:pct,itemStyle:{color:catColors[catKey]}};
        }),
        itemStyle:{borderRadius:[3,3,0,0]},
        label:{show:true,position:'top',color:'#ccc',fontSize:10,formatter:function(p){return p.value.toFixed(1)+'%';}}
      }]
    });
  }
  catBar('ov-quality','quality');
  catBar('ov-identity','identity');
  catBar('ov-device','device');
})();

// ====== Render channel charts ======
function renderChannel(key) {
  var d = DATA[key];
  if (!d || d._rendered) return;
  d._rendered = true;

  // Pie
  echarts.init(document.getElementById('pie-'+key)).setOption({
    tooltip:{trigger:'item',formatter:'{b}: {c} 份 ({d}%)'},
    series:[{type:'pie',radius:['52%','75%'],center:['50%','48%'],itemStyle:{borderRadius:5,borderColor:'#0f1923',borderWidth:3},label:{color:'#ccc',fontSize:11,formatter:'{b}\\n{d}%'},data:[
      {value:d.valid,name:'有效答卷',itemStyle:{color:green}},
      {value:d.invalid,name:'无效答卷',itemStyle:{color:red}}
    ]}]
  });

  // Bar chart — rules
  var bar = echarts.init(document.getElementById('bar-'+key));
  bar.setOption({
    tooltip:{trigger:'axis',axisPointer:{type:'shadow'},formatter:function(p){return p[0].name+'<br/>命中: '+p[0].value+' 条';}},
    grid:{left:2,right:40,bottom:2,top:6,containLabel:true},
    xAxis:{type:'value',axisLabel:{color:'#8899aa',fontSize:9},splitLine:{lineStyle:{color:'#1e3040'}}},
    yAxis:{type:'category',data:d.barRules.map(function(r){return r.name;}).reverse(),axisLabel:{color:'#ccc',fontSize:9},axisLine:{show:false},axisTick:{show:false},inverse:true},
    series:[{type:'bar',data:d.barRules.map(function(r){return {value:r.val,itemStyle:{color:r.color}};}).reverse(),barWidth:14,label:{show:true,position:'right',color:'#ccc',fontSize:9,formatter:function(p){return p.value>0?p.value:'';}},itemStyle:{borderRadius:[0,3,3,0]}}]
  });

  // Category donut
  var catChart = echarts.init(document.getElementById('cat-'+key));
  catChart.setOption({
    tooltip:{trigger:'item',formatter:function(p){return p.seriesName==='细则'?p.name:p.name+'<br/>合计: '+p.value+' 条';}},
    series:[
      {name:'分类',type:'pie',radius:['0%','42%'],center:['50%','48%'],itemStyle:{borderRadius:4,borderColor:'#0f1923',borderWidth:2},label:{position:'inner',fontSize:10,color:'#000',formatter:'{b}\\n{d}%'},
       data:[
         {value:d.catHits.quality,name:'答题质量',itemStyle:{color:catQuality}},
         {value:d.catHits.identity,name:'身份核验',itemStyle:{color:catIdentity}},
         {value:d.catHits.device,name:'设备甄别',itemStyle:{color:catDevice}},
       ]},
      {name:'细则',type:'pie',radius:['48%','74%'],center:['50%','48%'],itemStyle:{borderRadius:3,borderColor:'#0f1923',borderWidth:1},label:{color:'#ccc',fontSize:9},labelLine:{length:14,length2:10},
       data:[
         {value:d.ruleHits.trap,name:'陷阱题',itemStyle:{color:'#81d4fa'}},
         {value:d.ruleHits.time_short,name:'答题过快',itemStyle:{color:'#b3e5fc'}},
         {value:d.ruleHits.time_long,name:'答题超时',itemStyle:{color:'#e1f5fe'}},
         {value:d.ruleHits.age,name:'年龄不符',itemStyle:{color:'#a5d6a7'}},
         {value:d.ruleHits.id_err,name:'ID错误',itemStyle:{color:'#c8e6c9'}},
         {value:d.ruleHits.q9,name:'Q9配置',itemStyle:{color:'#ffcc80'}},
         {value:d.ruleHits.q10,name:'Q10内存',itemStyle:{color:'#ffe0b2'}},
         {value:d.ruleHits.q11,name:'Q11系统',itemStyle:{color:'#fff3e0'}},
       ].filter(function(x){return x.value>0;})}
    ]
  });

  // Sankey
  var qTotal = d.ruleHits.time_short + d.ruleHits.time_long;
  var idTotal = d.ruleHits.phone + d.ruleHits.email + d.ruleHits.id_err;
  var devTotal = d.ruleHits.q9 + d.ruleHits.q10 + d.ruleHits.q11;
  var sankey = echarts.init(document.getElementById('sankey-'+key));
  sankey.setOption({
    tooltip:{trigger:'item',triggerOn:'mousemove'},
    series:[{type:'sankey',layout:'none',emphasis:{focus:'adjacency'},nodeAlign:'left',layoutIterations:0,
      data:[
        {name:'原始\\n'+d.total.toLocaleString()},
        {name:'时间'},{name:'陷阱'},{name:'年龄'},{name:'格式'},{name:'设备'},
        {name:'✅有效\\n'+d.valid.toLocaleString()},
        {name:'❌无效\\n'+d.invalid.toLocaleString()}
      ],
      links:[
        {source:'原始\\n'+d.total.toLocaleString(),target:'时间',value:d.total},
        {source:'时间',target:'陷阱',value:d.total-qTotal,lineStyle:{color:blue}},
        {source:'时间',target:'❌无效\\n'+d.invalid.toLocaleString(),value:qTotal,lineStyle:{color:'#555'}},
        {source:'陷阱',target:'年龄',value:d.total-qTotal-d.ruleHits.trap,lineStyle:{color:blue}},
        {source:'陷阱',target:'❌无效\\n'+d.invalid.toLocaleString(),value:d.ruleHits.trap,lineStyle:{color:'#555'}},
        {source:'年龄',target:'格式',value:d.total-qTotal-d.ruleHits.trap-d.ruleHits.age,lineStyle:{color:blue}},
        {source:'年龄',target:'❌无效\\n'+d.invalid.toLocaleString(),value:d.ruleHits.age,lineStyle:{color:orange}},
        {source:'格式',target:'设备',value:d.total-qTotal-d.ruleHits.trap-d.ruleHits.age-idTotal,lineStyle:{color:blue}},
        {source:'格式',target:'❌无效\\n'+d.invalid.toLocaleString(),value:idTotal,lineStyle:{color:orange}},
        {source:'设备',target:'✅有效\\n'+d.valid.toLocaleString(),value:d.valid,lineStyle:{color:green}},
        {source:'设备',target:'❌无效\\n'+d.invalid.toLocaleString(),value:devTotal,lineStyle:{color:orange}}
      ].filter(function(l){return l.value>0;}),
      label:{color:'#ccc',fontSize:10},
      lineStyle:{color:'gradient',curveness:0.5}
    }]
  });
}

// ====== Countdown ======
(function(){
  var intervalMs = refreshInterval * 60 * 1000;
  var nextAt = new Date(Date.now() + intervalMs);
  function tick(){
    var left = Math.max(0, Math.floor((nextAt - Date.now()) / 1000));
    var m = Math.floor(left / 60), s = left % 60;
    document.getElementById('countdown').textContent = '下次刷新: ' + m + '分' + (s<10?'0':'') + s + '秒后';
    if (left <= 0) location.reload();
  }
  tick(); setInterval(tick, 1000);
})();

// ====== Responsive ======
window.addEventListener('resize',function(){
  ['ov-compare','ov-quality','ov-identity','ov-device'].forEach(function(id){
    var el=document.getElementById(id); if(el && el.clientWidth>0) echarts.getInstanceByDom(el)?.resize();
  });
  CHS.forEach(function(ch){
    ['pie-','bar-','cat-','sankey-'].forEach(function(pre){
      var el=document.getElementById(pre+ch.key); if(el && el.clientWidth>0) echarts.getInstanceByDom(el)?.resize();
    });
  });
});
</script>
</body>
</html>`;
}
