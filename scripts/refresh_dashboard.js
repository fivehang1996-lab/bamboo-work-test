// ============================================================
// 焕梦好游快爆 数据大屏 — 定时刷新脚本
// 用途: 拉取最新问卷数据 → 清洗 → 生成 HTML
// 频率: 每 30 分钟（由外部 cron 调度）
// ============================================================

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const VID = '364883388';
const DASHBOARD_HTML = 'D:\\claude\\分析报告\\焕梦好游快爆_清洗流水线.html';
const RAW_CSV = 'D:\\claude\\问卷数据\\焕梦好游快爆_原始.csv';
const REFRESH_LOG = 'D:\\claude\\问卷数据\\刷新日志.md';

// ======================== 第 1 步：拉取最新数据 ========================
console.log('[1/4] 拉取最新问卷数据...');
try {
  // 获取下载链接
  const result = JSON.parse(execSync(
    `wjx response download --vid ${VID} --suffix 0 --query_count 3000 --json`,
    { encoding: 'utf-8', timeout: 60000 }
  ));
  if (!result.data || !result.data.download_url) {
    throw new Error('未获取到下载链接: ' + JSON.stringify(result));
  }
  const url = result.data.download_url;
  console.log('  下载链接已获取, 答卷数:', result.data.join_times);

  // 下载 CSV
  execSync(`powershell -Command "Invoke-WebRequest -Uri '${url}' -OutFile '${RAW_CSV}'"`,
    { timeout: 120000 });
  console.log('  CSV 已保存');
} catch (e) {
  console.error('  拉取失败:', e.message);
  console.log('  将使用上次的 CSV 继续...');
}

// ======================== 第 2 步：数据清洗 ========================
console.log('[2/4] 执行数据清洗...');

let raw = fs.readFileSync(RAW_CSV, 'utf-8');
if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
const lines = raw.split('\n').filter(l => l.trim());
const header = lines[0];

const NOW = new Date();
const NOW_YEAR = NOW.getFullYear();
const NOW_MONTH = NOW.getMonth() + 1;

function parseCSVLine(line) {
  const r = []; let cur = '', inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (ch === ',' && !inQ) { r.push(cur); cur = ''; }
    else cur += ch;
  }
  r.push(cur); return r;
}
function parseSeconds(v) {
  if (!v) return null;
  const m = v.match(/^(\d+)\s*秒?$/);
  return m ? parseInt(m[1], 10) : null;
}
function calcAge(birth) {
  if (!birth) return null;
  const m = birth.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  let age = NOW_YEAR - parseInt(m[1], 10);
  if (NOW_MONTH < parseInt(m[2], 10)) age--;
  return age;
}
function isValidPhone(s) {
  return s && /^1\d{10}$/.test(s.trim());
}
function isValidEmail(s) {
  if (!s || !s.trim()) return false;
  const at = s.indexOf('@');
  if (at <= 0 || at === s.length - 1) return false;
  const d = s.substring(at + 1);
  return d.includes('.') && d.indexOf('.') < d.length - 1;
}
function isValidId(s) {
  return s && /^\d+$/.test(s.trim());
}

// 列索引
const hdr = header.split(',');
const idx = {
  id:        hdr.findIndex(c => c.includes('好游快爆账号ID')),
  birth:     hdr.findIndex(c => c.includes('出生年月')),
  time:      hdr.findIndex(c => c.includes('所用时间')),
  processor: hdr.findIndex(c => c.includes('手机处理器')),
  ram:       hdr.findIndex(c => c.includes('运行内存')),
  os:        hdr.findIndex(c => c.includes('PC设备的系统版本')),
  trap:      hdr.findIndex(c => c.includes('18、')),
  phone:     hdr.findIndex(c => c.includes('手机号码')),
  email:     hdr.findIndex(c => c.includes('邮箱')),
};

// 10 条规则
const rules = [
  { key:'time_short', cat:'quality',  label:'答题过快(<60s)',    check:r=>{const s=parseSeconds(r[idx.time]);return s!==null&&s<60;} },
  { key:'time_long',  cat:'quality',  label:'答题超时(>6000s)',  check:r=>{const s=parseSeconds(r[idx.time]);return s!==null&&s>6000;} },
  { key:'trap',       cat:'quality',  label:'陷阱题(射击类)',    check:r=>(r[idx.trap]||'').includes('射击类') },
  { key:'age',        cat:'identity', label:'年龄不符',          check:r=>{const a=calcAge(r[idx.birth]);return a!==null&&(a<18||a>100);} },
  { key:'phone',      cat:'identity', label:'手机号错误',        check:r=>!isValidPhone(r[idx.phone]) },
  { key:'email',      cat:'identity', label:'邮箱错误',          check:r=>!isValidEmail(r[idx.email]) },
  { key:'id',         cat:'identity', label:'快爆ID错误',        check:r=>!isValidId(r[idx.id]) },
  { key:'q9',         cat:'device',   label:'Q9不清楚处理器',    check:r=>(r[idx.processor]||'').startsWith('不清楚具体配置') },
  { key:'q10',        cat:'device',   label:'Q10不清楚内存',     check:r=>(r[idx.ram]||'').trim()==='不清楚' },
  { key:'q11',        cat:'device',   label:'Q11其他OS',         check:r=>{const v=(r[idx.os]||'').trim();return v==='其他 Windows 系统'||v==='其他操作系统（如 Linux、鸿蒙）';} },
];

let total = 0, validCount = 0;
const ruleHits = {};
rules.forEach(r => { ruleHits[r.key] = 0; });
const catHits = { quality: 0, identity: 0, device: 0 };

for (let i = 1; i < lines.length; i++) {
  const row = parseCSVLine(lines[i]);
  if (row.length < 20) continue;
  total++;
  const failed = rules.filter(r => r.check(row)).map(r => r.key);
  if (failed.length === 0) {
    validCount++;
  } else {
    const cats = new Set();
    failed.forEach(k => {
      ruleHits[k]++;
      const rule = rules.find(r => r.key === k);
      if (rule) cats.add(rule.cat);
    });
    cats.forEach(c => { catHits[c]++; });
  }
}

const invalidTotal = total - validCount;

// ======================== 第 3 步：生成 HTML ========================
console.log(`[3/4] 生成大屏 HTML (有效:${validCount}, 无效:${invalidTotal})...`);

const updateTime = NOW.toLocaleString('zh-CN', { hour12: false });
const refreshIntervalMin = 30;

// 嵌入 JSON 数据
const embeddedData = {
  total, validCount, invalidTotal,
  rate: ((validCount / total) * 100).toFixed(1),
  updateTime,
  ruleHits: {
    time_short: ruleHits.time_short,
    time_long: ruleHits.time_long,
    trap: ruleHits.trap,
    age: ruleHits.age,
    phone: ruleHits.phone,
    email: ruleHits.email,
    id: ruleHits.id,
    q9: ruleHits.q9,
    q10: ruleHits.q10,
    q11: ruleHits.q11,
  },
  catHits,
};

const html = generateHTML(embeddedData, refreshIntervalMin);
fs.writeFileSync(DASHBOARD_HTML, html, 'utf-8');
// 同步更新根目录 index.html（Netlify 部署用）
fs.writeFileSync('D:\\claude\\index.html', html, 'utf-8');

// ======================== 第 4 步：写日志 ========================
console.log('[4/4] 写入刷新日志...');
const logEntry = `| ${updateTime} | ${total} | ${validCount} | ${invalidTotal} | ${((validCount/total)*100).toFixed(1)}% |\n`;
if (!fs.existsSync(REFRESH_LOG)) {
  fs.writeFileSync(REFRESH_LOG, '| 刷新时间 | 原始 | 有效 | 无效 | 有效率 |\n|----------|------|------|------|--------|\n' + logEntry, 'utf-8');
} else {
  fs.appendFileSync(REFRESH_LOG, logEntry, 'utf-8');
}

console.log('✅ 大屏已刷新:', updateTime);
console.log('   文件:', DASHBOARD_HTML);

// ======================== HTML 模板 ========================
function generateHTML(data, intervalMin) {
  const d = data;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="refresh" content="${intervalMin * 60}">
<title>焕梦测试·好游快爆 — 数据清洗大屏</title>
<script src="https://cdn.jsdelivr.net/npm/echarts@5.6.0/dist/echarts.min.js"></script>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Microsoft YaHei','PingFang SC',sans-serif; background:#0f1923; color:#e0e0e0; padding:20px; }
  .container { max-width:1280px; margin:0 auto; }

  /* Header */
  .header { display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px; }
  .header h1 { font-size:24px; color:#fff; }
  .live-badge { display:inline-flex; align-items:center; gap:6px; background:rgba(239,83,80,0.15); border:1px solid #ef5350; border-radius:20px; padding:6px 14px; }
  .live-dot { width:8px; height:8px; background:#ef5350; border-radius:50%; animation:pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
  .live-text { color:#ef5350; font-size:12px; font-weight:bold; }
  .update-info { font-size:12px; color:#8899aa; text-align:right; }
  .update-info .time { color:#fff; }
  .countdown { color:#ffa726; font-size:11px; }

  /* Steps */
  .steps { display:flex; align-items:flex-start; justify-content:center; gap:0; margin-bottom:28px; flex-wrap:wrap; }
  .step { background:#1a2a3a; border:2px solid #2a3a4a; border-radius:12px; padding:12px 14px; text-align:center; min-width:110px; }
  .step .num { display:inline-block; width:20px; height:20px; line-height:20px; border-radius:50%; background:#4fc3f7; color:#000; font-size:11px; font-weight:bold; margin-bottom:4px; }
  .step .icon { font-size:22px; margin-bottom:2px; }
  .step .label { font-size:12px; font-weight:bold; color:#fff; }
  .step .detail { font-size:10px; color:#8899aa; margin-top:2px; line-height:1.3; }
  .step-arrow { display:flex; align-items:center; padding:0 6px; margin-top:16px; }
  .step-arrow span { font-size:18px; color:#4fc3f7; font-weight:bold; }

  /* Cards */
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:14px; margin-bottom:22px; }
  .card { background:#1a2a3a; border-radius:10px; padding:16px; text-align:center; }
  .card .num { font-size:32px; font-weight:bold; }
  .card .label { font-size:12px; color:#8899aa; margin-top:4px; }
  .card.green .num { color:#66bb6a; }
  .card.red .num { color:#ef5350; }
  .card.blue .num { color:#4fc3f7; }
  .card.orange .num { color:#ffa726; }

  /* Charts */
  .chart-row { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:18px; }
  .chart-box { background:#1a2a3a; border-radius:10px; padding:14px; }
  .chart-box.full { grid-column:1 / -1; }
  .chart-box h3 { font-size:13px; color:#ccc; margin-bottom:4px; }

  /* Rules */
  .rule-box { background:#1a2a3a; border-radius:10px; padding:16px; margin-bottom:20px; }
  .rule-box h3 { font-size:14px; margin-bottom:12px; color:#fff; }
  .cat-section { margin-bottom:12px; }
  .cat-title { font-size:12px; font-weight:bold; margin-bottom:6px; padding:3px 8px; display:inline-block; border-radius:4px; }
  .cat-title.quality { color:#4fc3f7; background:rgba(79,195,247,0.1); }
  .cat-title.identity { color:#66bb6a; background:rgba(102,187,106,0.1); }
  .cat-title.device { color:#ffa726; background:rgba(255,167,38,0.1); }
  .rule-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; }
  .rule-item { display:flex; align-items:center; gap:6px; padding:7px 8px; background:#0f1923; border-radius:6px; border-left:3px solid #2a3a4a; font-size:11px; }
  .rule-item .hit { font-size:13px; font-weight:bold; white-space:nowrap; margin-left:auto; }
  .rule-item .hit.none { color:#667788; }

  @media (max-width:768px) {
    .rule-grid { grid-template-columns:1fr; }
    .chart-row { grid-template-columns:1fr; }
    .steps { flex-direction:column; align-items:center; }
    .step-arrow { transform:rotate(90deg); margin:2px 0; }
  }
</style>
</head>
<body>
<div class="container">
  <!-- Header -->
  <div class="header">
    <div style="display:flex;align-items:center;gap:12px;">
      <h1>🔬 焕梦测试招募问卷 · 数据清洗大屏</h1>
      <span class="live-badge"><span class="live-dot"></span><span class="live-text">LIVE</span></span>
    </div>
    <div class="update-info">
      <div>最后更新 <span class="time">${d.updateTime}</span></div>
      <div class="countdown" id="countdown">下次刷新: 计算中...</div>
    </div>
  </div>

  <!-- Steps -->
  <div class="steps">
    <div class="step"><div class="num">1</div><div class="icon">📥</div><div class="label">导出原始答卷</div><div class="detail">从问卷星后台<br/>导出全部回收数据</div></div>
    <div class="step-arrow"><span>→</span></div>
    <div class="step"><div class="num">2</div><div class="icon">📋</div><div class="label">设定筛选规则</div><div class="detail">按 3 类 10 条规则<br/>逐份校验答卷质量</div></div>
    <div class="step-arrow"><span>→</span></div>
    <div class="step"><div class="num">3</div><div class="icon">✂️</div><div class="label">剔除无效数据</div><div class="detail">命中任一规则的答卷<br/>标记为无效并移除</div></div>
    <div class="step-arrow"><span>→</span></div>
    <div class="step"><div class="num">4</div><div class="icon">✅</div><div class="label">输出清洗结果</div><div class="detail">交付有效数据<br/>附清洗记录报告</div></div>
  </div>

  <!-- KPI -->
  <div class="cards">
    <div class="card blue"><div class="num">${d.total.toLocaleString()}</div><div class="label">原始答卷总数</div></div>
    <div class="card green"><div class="num">${d.validCount.toLocaleString()}</div><div class="label">清洗后有效答卷</div></div>
    <div class="card red"><div class="num">${d.invalidTotal.toLocaleString()}</div><div class="label">剔除无效答卷</div></div>
    <div class="card orange"><div class="num">${d.rate}%</div><div class="label">有效回收率</div></div>
  </div>

  <!-- Rules -->
  <div class="rule-box">
    <h3>📋 清洗规则（3 类 × 10 条）</h3>
    <div class="cat-section">
      <span class="cat-title quality">🔵 一、答题质量 — 判断用户是否认真作答</span>
      <div class="rule-grid">
        <div class="rule-item" style="border-left-color:#4fc3f7;"><span>答题过快</span><span style="font-size:10px;color:#8899aa;">所用时间 &lt; 60 秒</span><span class="hit" style="color:#81d4fa;">${d.ruleHits.time_short}</span></div>
        <div class="rule-item" style="border-left-color:#4fc3f7;"><span>答题超时</span><span style="font-size:10px;color:#8899aa;">所用时间 &gt; 6,000 秒</span><span class="hit" style="color:#81d4fa;">${d.ruleHits.time_long}</span></div>
        <div class="rule-item" style="border-left-color:#4fc3f7;"><span>陷阱题</span><span style="font-size:10px;color:#8899aa;">Q18 选"游戏类型（射击类）"</span><span class="hit" style="color:#81d4fa;">${d.ruleHits.trap}</span></div>
      </div>
    </div>
    <div class="cat-section">
      <span class="cat-title identity">🟢 二、身份核验 — 校验用户基本信息的真实性</span>
      <div class="rule-grid" style="grid-template-columns:1fr 1fr 1fr 1fr;">
        <div class="rule-item" style="border-left-color:#66bb6a;"><span>年龄不符</span><span style="font-size:10px;color:#8899aa;">&lt;18 或 &gt;100 岁</span><span class="hit" style="color:#a5d6a7;">${d.ruleHits.age}</span></div>
        <div class="rule-item" style="border-left-color:#66bb6a;"><span>手机号错误</span><span style="font-size:10px;color:#8899aa;">非11位 / 非1开头</span><span class="hit none">${d.ruleHits.phone}</span></div>
        <div class="rule-item" style="border-left-color:#66bb6a;"><span>邮箱错误</span><span style="font-size:10px;color:#8899aa;">缺少 @ / 域名异常</span><span class="hit none">${d.ruleHits.email}</span></div>
        <div class="rule-item" style="border-left-color:#66bb6a;"><span>快爆ID错误</span><span style="font-size:10px;color:#8899aa;">为空 / 非纯数字</span><span class="hit" style="color:#a5d6a7;">${d.ruleHits.id}</span></div>
      </div>
    </div>
    <div class="cat-section" style="margin-bottom:0;">
      <span class="cat-title device">🟠 三、设备甄别 — 筛选不清楚设备配置的用户</span>
      <div class="rule-grid">
        <div class="rule-item" style="border-left-color:#ffa726;"><span>Q9 不清楚处理器</span><span style="font-size:10px;color:#8899aa;">选"不清楚具体配置"</span><span class="hit" style="color:#ffcc80;">${d.ruleHits.q9}</span></div>
        <div class="rule-item" style="border-left-color:#ffa726;"><span>Q10 不清楚内存</span><span style="font-size:10px;color:#8899aa;">RAM 选"不清楚"</span><span class="hit" style="color:#ffcc80;">${d.ruleHits.q10}</span></div>
        <div class="rule-item" style="border-left-color:#ffa726;"><span>Q11 其他操作系统</span><span style="font-size:10px;color:#8899aa;">PC 系统选"其他"选项</span><span class="hit" style="color:#ffcc80;">${d.ruleHits.q11}</span></div>
      </div>
    </div>
  </div>

  <!-- Charts -->
  <div class="chart-row">
    <div class="chart-box"><h3>有效 vs 无效 占比</h3><div id="chart-pie" style="height:300px;"></div></div>
    <div class="chart-box"><h3>各规则命中数（按分类着色）</h3><div id="chart-bar" style="height:300px;"></div></div>
  </div>
  <div class="chart-row">
    <div class="chart-box"><h3>三类规则命中占比（内圈=分类，外圈=细则）</h3><div id="chart-category" style="height:300px;"></div></div>
    <div class="chart-box"><h3>数据流 — 从原始到有效</h3><div id="chart-sankey" style="height:300px;"></div></div>
  </div>
</div>

<script>
// ====== Embedded Data ======
var DATA = {
  total: ${d.total},
  valid: ${d.validCount},
  invalid: ${d.invalidTotal},
  rate: ${d.rate},
  ruleHits: ${JSON.stringify(d.ruleHits)},
  catHits: ${JSON.stringify(d.catHits)},
  updateTime: "${d.updateTime}",
  intervalMin: ${intervalMin}
};

var green='#66bb6a', red='#ef5350', blue='#4fc3f7', orange='#ffa726';
var catQuality='#4fc3f7', catIdentity='#66bb6a', catDevice='#ffa726';

// Countdown timer
(function(){
  var updateAt = new Date(DATA.updateTime);
  var intervalMs = DATA.intervalMin * 60 * 1000;
  var nextAt = new Date(updateAt.getTime() + intervalMs);

  function tick(){
    var now = new Date();
    var left = Math.max(0, Math.floor((nextAt - now) / 1000));
    var m = Math.floor(left / 60);
    var s = left % 60;
    document.getElementById('countdown').textContent =
      '下次刷新: ' + m + '分' + (s<10?'0':'') + s + '秒后';
    if (left <= 0) location.reload();
  }
  tick();
  setInterval(tick, 1000);
})();

// Chart helpers
function pie(id, data){ echarts.init(document.getElementById(id)).setOption({ tooltip:{trigger:'item',formatter:'{b}: {c} 份 ({d}%)'}, series:[{type:'pie',radius:['52%','75%'],center:['50%','48%'],itemStyle:{borderRadius:5,borderColor:'#0f1923',borderWidth:3},label:{color:'#ccc',fontSize:11,formatter:'{b}\\n{d}%'},emphasis:{label:{fontSize:16,fontWeight:'bold'}},data:data}] }); }

function bar(id, rules){
  var c = echarts.init(document.getElementById(id));
  c.setOption({ tooltip:{trigger:'axis',axisPointer:{type:'shadow'},formatter:function(p){return p[0].name+'<br/>命中: '+p[0].value+' 条';}}, grid:{left:2,right:40,bottom:2,top:6,containLabel:true}, xAxis:{type:'value',axisLabel:{color:'#8899aa',fontSize:10},splitLine:{lineStyle:{color:'#1e3040'}}}, yAxis:{type:'category',data:rules.map(function(r){return r.name;}).reverse(),axisLabel:{color:'#ccc',fontSize:10},axisLine:{show:false},axisTick:{show:false},inverse:true}, series:[{type:'bar',data:rules.map(function(r){return {value:r.val,itemStyle:{color:r.color}};}).reverse(),barWidth:16,label:{show:true,position:'right',color:'#ccc',fontSize:10,formatter:function(p){return p.value>0?p.value:'';}},itemStyle:{borderRadius:[0,3,3,0]}}] });
}

(function(){
  // 1. Pie
  pie('chart-pie', [{value:DATA.valid,name:'有效答卷',itemStyle:{color:green}},{value:DATA.invalid,name:'无效答卷',itemStyle:{color:red}}]);

  // 2. Bar — rules by category
  bar('chart-bar', [
    {name:'答题过快(<60s)',   val:DATA.ruleHits.time_short, color:catQuality},
    {name:'答题超时(>6000s)', val:DATA.ruleHits.time_long,  color:catQuality},
    {name:'陷阱题(射击类)',   val:DATA.ruleHits.trap,       color:catQuality},
    {name:'年龄不符',        val:DATA.ruleHits.age,         color:catIdentity},
    {name:'手机号错误',      val:DATA.ruleHits.phone,       color:catIdentity},
    {name:'邮箱错误',        val:DATA.ruleHits.email,       color:catIdentity},
    {name:'快爆ID错误',      val:DATA.ruleHits.id,          color:catIdentity},
    {name:'Q9不清楚处理器',  val:DATA.ruleHits.q9,          color:catDevice},
    {name:'Q10不清楚内存',   val:DATA.ruleHits.q10,         color:catDevice},
    {name:'Q11其他OS',       val:DATA.ruleHits.q11,         color:catDevice},
  ]);

  // 3. Category dual-donut
  echarts.init(document.getElementById('chart-category')).setOption({
    tooltip:{trigger:'item',formatter:function(p){return p.seriesName==='细则'?p.name:p.name+'<br/>合计命中: '+p.value+' 条';}},
    legend:{bottom:0,textStyle:{color:'#8899aa',fontSize:11}},
    series:[
      {name:'分类',type:'pie',radius:['0%','42%'],center:['50%','48%'],itemStyle:{borderRadius:4,borderColor:'#0f1923',borderWidth:2},label:{position:'inner',fontSize:10,color:'#000',formatter:'{b}\\n{d}%'},
       data:[
         {value:DATA.catHits.quality, name:'答题质量', itemStyle:{color:catQuality}},
         {value:DATA.catHits.identity,name:'身份核验', itemStyle:{color:catIdentity}},
         {value:DATA.catHits.device,  name:'设备甄别', itemStyle:{color:catDevice}},
       ]},
      {name:'细则',type:'pie',radius:['48%','74%'],center:['50%','48%'],itemStyle:{borderRadius:3,borderColor:'#0f1923',borderWidth:1},label:{color:'#ccc',fontSize:9,formatter:'{b}'},labelLine:{length:14,length2:10},
       data:[
         {value:DATA.ruleHits.trap, name:'陷阱题', itemStyle:{color:'#81d4fa'}},
         {value:DATA.ruleHits.time_short, name:'答题过快', itemStyle:{color:'#b3e5fc'}},
         {value:DATA.ruleHits.time_long,  name:'答题超时', itemStyle:{color:'#e1f5fe'}},
         {value:DATA.ruleHits.age,  name:'年龄不符', itemStyle:{color:'#a5d6a7'}},
         {value:DATA.ruleHits.id,   name:'ID错误', itemStyle:{color:'#c8e6c9'}},
         {value:DATA.ruleHits.q9,   name:'Q9不清楚配置', itemStyle:{color:'#ffcc80'}},
         {value:DATA.ruleHits.q10,  name:'Q10不清楚内存', itemStyle:{color:'#ffe0b2'}},
         {value:DATA.ruleHits.q11,  name:'Q11其他OS', itemStyle:{color:'#fff3e0'}},
       ].filter(function(d){return d.value>0;})}
    ]
  });

  // 4. Sankey
  var qTotal = DATA.ruleHits.time_short + DATA.ruleHits.time_long;
  var idTotal = DATA.ruleHits.phone + DATA.ruleHits.email + DATA.ruleHits.id;
  var devTotal = DATA.ruleHits.q9 + DATA.ruleHits.q10 + DATA.ruleHits.q11;
  echarts.init(document.getElementById('chart-sankey')).setOption({
    tooltip:{trigger:'item',triggerOn:'mousemove'},
    series:[{type:'sankey',layout:'none',emphasis:{focus:'adjacency'},nodeAlign:'left',layoutIterations:0,
      data:[
        {name:'原始\\n'+DATA.total.toLocaleString()},
        {name:'时间过滤'},{name:'陷阱过滤'},{name:'年龄过滤'},{name:'格式校验'},{name:'设备甄别'},
        {name:'\\u2705有效\\n'+DATA.valid.toLocaleString()},
        {name:'\\u274c无效\\n'+DATA.invalid.toLocaleString()}
      ],
      links:[
        {source:'原始\\n'+DATA.total.toLocaleString(), target:'时间过滤', value:DATA.total},
        {source:'时间过滤', target:'陷阱过滤', value:DATA.total-qTotal, lineStyle:{color:blue}},
        {source:'时间过滤', target:'\\u274c无效\\n'+DATA.invalid.toLocaleString(), value:qTotal, lineStyle:{color:'#555'}},
        {source:'陷阱过滤', target:'年龄过滤', value:DATA.total-qTotal-DATA.ruleHits.trap, lineStyle:{color:blue}},
        {source:'陷阱过滤', target:'\\u274c无效\\n'+DATA.invalid.toLocaleString(), value:DATA.ruleHits.trap, lineStyle:{color:'#555'}},
        {source:'年龄过滤', target:'格式校验', value:DATA.total-qTotal-DATA.ruleHits.trap-DATA.ruleHits.age, lineStyle:{color:blue}},
        {source:'年龄过滤', target:'\\u274c无效\\n'+DATA.invalid.toLocaleString(), value:DATA.ruleHits.age, lineStyle:{color:orange}},
        {source:'格式校验', target:'设备甄别', value:DATA.total-qTotal-DATA.ruleHits.trap-DATA.ruleHits.age-idTotal, lineStyle:{color:blue}},
        {source:'格式校验', target:'\\u274c无效\\n'+DATA.invalid.toLocaleString(), value:idTotal, lineStyle:{color:orange}},
        {source:'设备甄别', target:'\\u2705有效\\n'+DATA.valid.toLocaleString(), value:DATA.valid, lineStyle:{color:green}},
        {source:'设备甄别', target:'\\u274c无效\\n'+DATA.invalid.toLocaleString(), value:devTotal, lineStyle:{color:orange}}
      ].filter(function(l){return l.value>0;}),
      label:{color:'#ccc',fontSize:11},
      lineStyle:{color:'gradient',curveness:0.5}
    }]
  });
})();

window.addEventListener('resize',function(){
  ['chart-pie','chart-bar','chart-category','chart-sankey'].forEach(function(id){
    var el=document.getElementById(id); if(el) echarts.getInstanceByDom(el)?.resize();
  });
});
</script>
</body>
</html>`;
}
