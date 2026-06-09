// ============================================================
// 焕梦测试招募问卷 — 三渠道数据大屏 刷新脚本
// 渠道: TapTap(362635200) | 主站(363467391) | 好游快爆(364883388)
// ============================================================

const fs = require('fs');
const { execSync } = require('child_process');
const XLSX = require('xlsx');

const CHANNELS = [
  { key: 'tap',        name: 'TapTap',      vid: '362635200', priority: 1 },
  { key: 'main',       name: '主站',         vid: '363467391', priority: 3 },
  { key: 'haoyou',     name: '好游快爆',     vid: '364883388', priority: 2 },
  { key: 'gamecenter', name: 'GameCenter',   vid: null,        priority: 4, source: 'xlsx' },
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

// AMD GPU 性能分级: >= RTX 3060 为高端
function isAmdHighEnd(gpuStr) {
  const g = (gpuStr || '').trim();
  if (!g.includes('AMD') && !g.includes('Radeon')) return false;
  // RX 9000/7000 全系列 >= RTX 3060
  if (g.includes('RX 9000') || g.includes('RX 90') || g.includes('RX 7000') || g.includes('RX 78') || g.includes('RX 79') || g.includes('RX 77')) return true;
  // RX 6000: 6600+ >= RTX 3060; 6500/6400 低于
  if (g.includes('RX 6800') || g.includes('RX 6950') || g.includes('RX 6750') || g.includes('RX 6700') || g.includes('RX 6650') || g.includes('RX 6600')) return true;
  if (g.includes('RX 6500') || g.includes('RX 6400') || g.includes('RX 56') || g.includes('RX 55')) return false;
  // RX 5700 ≈ RTX 3060
  if (g.includes('RX 5700')) return true;
  // 其他AMD/不确定的AMD系列 按保守处理不算高端
  return false;
}

// GPU 自由文本分类 (GameCenter 专用)
function classGpuGC(g) {
  const v = (g || '').trim();
  if (!v) return 'empty';
  const vl = v.toLowerCase();
  const isNv = vl.includes('nvidia') || vl.includes('n卡') || vl.includes('英伟达') || vl.includes('geforce') || vl.includes('gtx') || vl.includes('rtx') || vl.includes('nv');
  const isAmd = vl.includes('amd') || vl.includes('radeon') || vl.includes('rx');

  // RTX 50
  if (vl.includes('rtx50') || vl.includes('rtx 50') || /(?:^|[^0-9])50[789]0/.test(vl) || /(?:^|[^0-9])5090/.test(vl)) return 'rtx50';
  if (/(?:^|[^0-9])5060/.test(vl) && !vl.includes('rtx40') && !vl.includes('3060')) return 'rtx50';
  // RTX 40
  if (vl.includes('rtx40') || vl.includes('rtx 40') || /(?:^|[^0-9])40[6789]0/.test(vl) || /(?:^|[^0-9])4090/.test(vl)) return 'rtx40';
  if (/(?:^|[^0-9])4050/.test(vl) && !vl.includes('rtx30') && !vl.includes('3060')) return 'rtx40';
  // RTX 30
  if (vl.includes('rtx30') || /(?:^|[^0-9])30[56789]0/.test(vl) || /(?:^|[^0-9])3090/.test(vl)) return 'rtx30';
  if (/(?:^|[^0-9])3060/.test(vl) || /^306\b/.test(vl)) return 'rtx30';
  // Other RTX
  if (vl.includes('rtx')) return 'rtxOther';
  // Intel Arc high
  if (vl.includes('arc') && /a770|a750|b580|b570|130t/i.test(vl)) return 'intelArc';
  // AMD high
  if (isAmd) {
    if (/9\d{3}/.test(vl) || /90[7-9]0|9070|9060/.test(vl)) return 'amdHigh';
    if (/7\d{3}/.test(vl) || /79\d{2}|7900|7800|7700|7650/.test(vl)) return 'amdHigh';
    if (/69[05]0|6800|6750|6700|6650|6600|5700/.test(vl)) return 'amdHigh';
    return 'amdLow';
  }
  if (!isNv) {
    if (/(?:^|[^0-9])9070|9060/.test(vl)) return 'amdHigh';
    if (/(?:^|[^0-9])7900|7800|7700|7650/.test(vl)) return 'amdHigh';
    if (/(?:^|[^0-9])6950|6900|6800|6750|6700|6650|6600/.test(vl)) return 'amdHigh';
    if (/(?:^|[^0-9])5700/.test(vl)) return 'amdHigh';
    if (/rx\s*\d{3,4}/i.test(vl)) return 'amdLow';
  }
  // Integrated
  if (vl.includes('集成') || vl.includes('核显') || vl.includes('uhd') || vl.includes('iris') || vl.includes('hd graphics') || vl.includes('780m') || vl.includes('radeon graphics')) return 'integrated';
  if (vl.includes('arc')) return 'integrated';
  // Garbage
  if (/^[\d. ?！。，,、]+$/.test(vl) || vl.length <= 2) return 'garbage';
  if (['不记得','不知道','忘了','不清楚','没有','无','懒得看','不会看','不懂','忘记了','不记得了','没','无显','不知道呀','不便透露','个人隐私','好麻烦','还没睡呢','谢谢','。','?','??','www','kj','ye','我用的手机'].includes(vl)) return 'garbage';
  return 'other';
}

// ======================== 下载 CSV ========================
function downloadCSV(vid, label) {
  const csvPath = `${DATA_DIR}\\焕梦_${label}_原始.csv`;

  // GameCenter: 从本地 XLSX 读取，直接返回数据不写 CSV
  if (!vid) {
    try {
      const xlsxPath = 'C:/Users/zhuzi/Desktop/焕梦测试招募问卷2026-06-09-11-09-49.xlsx';
      console.log(`  读取 ${label} XLSX...`);
      const wb = XLSX.readFile(xlsxPath);
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
      console.log(`    ${label}: ${data.length - 1} 份答卷`);
      return { path: null, total: data.length - 1, _xlsxData: data };
    } catch (e) {
      console.error(`    ${label} XLSX 读取失败: ${e.message}`);
      return { path: null, total: 0 };
    }
  }

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
    gpu:       header.findIndex(c => c.includes('显卡')),
    cpu:       header.findIndex(c => c.includes('CPU') || c.includes('处理器（CPU）')),
    trap:      header.findIndex(c => c.includes('18、')),
    phone:     header.findIndex(c => c.includes('手机号码')),
    email:     header.findIndex(c => c.includes('邮箱')),
    platform:  header.findIndex(c => c.includes('设备平台')),
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
  const platform = { pc: 0, android: 0, ios: 0 };
  // 设备分层统计
  const device = {
    // 处理器分层（手机用户）
    proc: { elite:0, gen3:0, gen1_2:0, low:0, unknown:0, skip:0 },
    // RAM 分层
    ram: { g16:0, g12:0, g8:0, g6:0, g4:0, unknown:0, skip:0 },
    // GPU 分层（PC用户）
    gpu: { rtx50:0, rtx40:0, rtx30:0, rtxOther:0, amd:0, integrated:0, unknown:0, skip:0 },
    // CPU 分层（PC用户）
    cpu: { i9u9:0, i7u7:0, i5u5:0, i3:0, r9:0, r7:0, r5:0, unknown:0, skip:0 },
  };

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.length < 20) continue;
    total++;
    const failed = rules.filter(r => r.check(row)).map(r => r.key);
    if (failed.length === 0) {
      validCount++;
      // 统计有效答卷的平台分布
      const plat = (row[idx.platform] || '').replace(/\*.*?\*/g, '');
      if (plat.includes('PC')) platform.pc++;
      if (plat.includes('安卓')) platform.android++;
      if (plat.includes('iOS')) platform.ios++;

      // 设备分层统计
      const proc = (row[idx.processor] || '').trim();
      if (proc === '(跳过)') device.proc.skip++;
      else if (proc.startsWith('不清楚')) device.proc.unknown++;
      else if (proc.includes('Elite') || proc.includes('9400')) device.proc.elite++;
      else if (proc.includes('Gen3') || proc.includes('9300')) device.proc.gen3++;
      else if (proc.includes('Gen1') || proc.includes('Gen2') || proc.includes('9200') || proc.includes('870') || proc.includes('888')) device.proc.gen1_2++;
      else device.proc.low++;

      const ramVal = (row[idx.ram] || '').trim();
      if (ramVal === '(跳过)') device.ram.skip++;
      else if (ramVal === '不清楚') device.ram.unknown++;
      else if (ramVal.includes('16')) device.ram.g16++;
      else if (ramVal.includes('12')) device.ram.g12++;
      else if (ramVal.includes('8')) device.ram.g8++;
      else if (ramVal.includes('6')) device.ram.g6++;
      else device.ram.g4++;

      const gpuVal = (row[idx.gpu] || '').trim();
      if (gpuVal === '(跳过)') device.gpu.skip++;
      else if (gpuVal.includes('不清楚')) device.gpu.unknown++;
      else if (gpuVal.includes('RTX50')) device.gpu.rtx50++;
      else if (gpuVal.includes('RTX40')) device.gpu.rtx40++;
      else if (gpuVal.includes('RTX30')) device.gpu.rtx30++;
      else if (gpuVal.includes('RTX')) device.gpu.rtxOther++;
      else if (gpuVal.includes('AMD')) device.gpu.amd++;
      else if (gpuVal.includes('集成')) device.gpu.integrated++;
      else device.gpu.unknown++;

      const cpuVal = (row[idx.cpu] || '').trim();
      if (cpuVal === '(跳过)') device.cpu.skip++;
      else if (cpuVal.includes('不清楚')) device.cpu.unknown++;
      else if (cpuVal.includes('i9') || cpuVal.includes('Ultra 9')) device.cpu.i9u9++;
      else if (cpuVal.includes('i7') || cpuVal.includes('Ultra 7')) device.cpu.i7u7++;
      else if (cpuVal.includes('i5') || cpuVal.includes('Ultra 5')) device.cpu.i5u5++;
      else if (cpuVal.includes('i3')) device.cpu.i3++;
      else if (cpuVal.includes('Ryzen 9')) device.cpu.r9++;
      else if (cpuVal.includes('Ryzen 7')) device.cpu.r7++;
      else if (cpuVal.includes('Ryzen 5')) device.cpu.r5++;
      else device.cpu.skip++;
    } else {
      const cats = new Set();
      failed.forEach(k => { ruleHits[k]++; const rl = rules.find(r => r.key === k); if (rl) cats.add(rl.cat); });
      cats.forEach(c => { catHits[c]++; });
    }
  }

  return {
    total, valid: validCount, invalid: total - validCount,
    rate: total > 0 ? ((validCount / total) * 100).toFixed(1) : '0.0',
    ruleHits, catHits, platform, device, updateTime: UPDATE_TIME,
  };
}

// ======================== GameCenter 专用清洗 ========================
function cleanSurveyGC(xlsxData, label) {
  if (!xlsxData || !xlsxData.length) return null;
  const lines = xlsxData; // 直接使用内存中的二维数组
  const header = lines[0];

  // 列结构 (16 列): 0答案ID 1提交时间 2答题耗时 3确认参与 4设备平台 5手机品牌 6处理器 7内存 8PC系统 9CPU 10GPU 11-15游戏相关
  const rules = [
    { key:'time_short', cat:'quality',  label:'答题过快(<30s)',    check: r => { const s = parseSeconds(r[2]); return s !== null && s < 30; } },
    { key:'time_long',  cat:'quality',  label:'答题超时(>6000s)',  check: r => { const s = parseSeconds(r[2]); return s !== null && s > 6000; } },
    { key:'trap',       cat:'quality',  label:'陷阱题(射击类)',    check: r => { const v = (r[15] || '').trim(); return v.split('，').map(x => x.trim()).includes('H'); } },
    { key:'abandon',    cat:'quality',  label:'放弃参与',          check: r => (r[3] || '').trim() === 'B' },
    { key:'q9_proc',    cat:'device',   label:'Q6不清楚处理器',    check: r => (r[6] || '').trim() === 'E' },
    { key:'q10_ram',    cat:'device',   label:'Q7不清楚内存',      check: r => (r[7] || '').trim() === 'F' },
    { key:'os_other',   cat:'device',   label:'Q8 PC系统选其他',   check: r => { const v = (r[8] || '').trim(); return v === 'D' || v === 'E'; } },
  ];

  let total = 0, validCount = 0;
  const ruleHits = {}; rules.forEach(r => { ruleHits[r.key] = 0; });
  const catHits = { quality: 0, device: 0 };
  const platform = { pc: 0, android: 0, ios: 0 };
  const device = {
    proc: { elite:0, gen3:0, gen1_2:0, low:0, unknown:0, skip:0 },
    ram:  { g16:0, g12:0, g8:0, g6:0, g4:0, unknown:0, skip:0 },
    gpu:  { rtx50:0, rtx40:0, rtx30:0, rtxOther:0, amdHigh:0, amdLow:0, intelArc:0, integrated:0, garbage:0, other:0, empty:0 },
    cpu:  { elite:0, gen3:0, gen1_2:0, low:0, unknown:0, skip:0 },
  };

  for (let i = 1; i < lines.length; i++) {
    const row = Array.isArray(lines[i]) ? lines[i] : parseCSVLine(lines[i]);
    if (!row || row.length < 10) continue;
    total++;
    const failed = rules.filter(r => r.check(row)).map(r => r.key);
    if (failed.length === 0) {
      validCount++;
      // 平台
      const plat = (row[4] || '').trim();
      if (plat.includes('A')) platform.pc++;
      if (plat.includes('B')) platform.android++;
      // 处理器 (字母映射)
      const proc = (row[6] || '').trim();
      if (!proc) device.proc.skip++;
      else if (proc === 'E') device.proc.unknown++;
      else if (proc === 'D') device.proc.elite++;
      else if (proc === 'C') device.proc.gen3++;
      else if (proc === 'B') device.proc.gen1_2++;
      else if (proc === 'A') device.proc.low++;
      else device.proc.skip++;
      // 内存 (字母映射)
      const ram = (row[7] || '').trim();
      if (!ram) device.ram.skip++;
      else if (ram === 'E') device.ram.g16++;
      else if (ram === 'D') device.ram.g12++;
      else if (ram === 'C') device.ram.g8++;
      else if (ram === 'B') device.ram.g6++;
      else if (ram === 'A') device.ram.g4++;
      else if (ram === 'F') device.ram.unknown++;
      else device.ram.skip++;
      // GPU (自由文本)
      device.gpu[classGpuGC(row[10])]++;
    } else {
      const cats = new Set();
      failed.forEach(k => { ruleHits[k]++; const rl = rules.find(r => r.key === k); if (rl) cats.add(rl.cat); });
      cats.forEach(c => { catHits[c]++; });
    }
  }

  return {
    total, valid: validCount, invalid: total - validCount,
    rate: total > 0 ? ((validCount / total) * 100).toFixed(1) : '0.0',
    ruleHits, catHits, platform, device, updateTime: UPDATE_TIME,
    _gc: true, // 标记为 GameCenter
  };
}

// ======================== 跨渠道去重 ========================
function dedupAcrossChannels(results) {
  // 从各渠道有效答卷中提取手机号
  // 优先保留：TapTap(priority=1) > 好游快爆(2) > 主站(3)
  const phoneMap = new Map(); // phone → { channel, phone }
  const chCounts = { tap: 0, haoyou: 0, main: 0 };

  CHANNELS.forEach(ch => {
    if (ch.source === 'xlsx') return; // GameCenter 无手机号，跳过去重
    const csvPath = `${DATA_DIR}\\焕梦_${ch.name}_原始.csv`;
    if (!fs.existsSync(csvPath)) return;
    let raw = fs.readFileSync(csvPath, 'utf-8');
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    const lines = raw.split('\n').filter(l => l.trim());
    const header = lines[0].split(',');
    const phoneIdx = header.findIndex(c => c.includes('手机号码'));
    // 重用清洗逻辑
    const idx = {
      id:        header.findIndex(c => c.includes('账号ID') || c.includes('账户ID')),
      birth:     header.findIndex(c => c.includes('出生年月')),
      time:      header.findIndex(c => c.includes('所用时间')),
      processor: header.findIndex(c => c.includes('手机处理器')),
      ram:       header.findIndex(c => c.includes('运行内存')),
      os:        header.findIndex(c => c.includes('PC设备的系统版本')),
      gpu:       header.findIndex(c => c.includes('显卡')),
      ip:        header.findIndex(c => c.includes('IP')),
      platform:  header.findIndex(c => c.includes('设备平台')),
      trap:      header.findIndex(c => c.includes('18、')),
      phone:     phoneIdx,
      email:     header.findIndex(c => c.includes('邮箱')),
    };
    const rules = [
      { check: r => { const s = parseSeconds(r[idx.time]); return s !== null && s < 60; } },
      { check: r => { const s = parseSeconds(r[idx.time]); return s !== null && s > 6000; } },
      { check: r => (r[idx.trap] || '').includes('射击类') },
      { check: r => { const a = calcAge(r[idx.birth]); return a !== null && (a < 18 || a > 100); } },
      { check: r => !isValidPhone(r[idx.phone]) },
      { check: r => !isValidEmail(r[idx.email]) },
      { check: r => idx.id >= 0 && !isValidId(r[idx.id]) },
      { check: r => (r[idx.processor] || '').startsWith('不清楚具体配置') },
      { check: r => (r[idx.ram] || '').trim() === '不清楚' },
      { check: r => { const v = (r[idx.os] || '').trim(); return v === '其他 Windows 系统' || v === '其他操作系统（如 Linux、鸿蒙）'; } },
    ];

    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      if (row.length < 20) continue;
      if (rules.some(r => r.check(row))) continue; // 跳过无效
      const phone = (row[phoneIdx] || '').trim();
      if (!phone) continue;
      const existing = phoneMap.get(phone);
      if (!existing || ch.priority < existing.priority) {
        // 新号码，或当前渠道优先级更高
        if (existing) chCounts[existing.channel]--;
        phoneMap.set(phone, { channel: ch.key, phone,
          proc: (row[idx.processor] || '').trim(),
          ram:  (row[idx.ram] || '').trim(),
          gpu:  (row[idx.gpu] || '').trim(),
          ip:   (row[idx.ip] || '').trim(),
          platform: (row[idx.platform] || '').replace(/\*.*?\*/g, '').trim(),
        });
        chCounts[ch.key]++;
      }
    }
  });

  // GameCenter 无手机号不参与去重，仅统计三渠道
  const beforeTotal = Object.values(results).reduce((s, d) => s + (d && !d._gc ? (d.valid || 0) : 0), 0);
  const afterTotal = phoneMap.size;
  const duplicates = beforeTotal - afterTotal;

  // 去重后设备分层统计（含 AMD 分级）
  const dedupDevice = {
    proc: { elite:0, gen3:0, gen1_2:0, low:0, unknown:0, skip:0 },
    ram:  { g16:0, g12:0, g8:0, g6:0, g4:0, unknown:0, skip:0 },
    gpu:  { rtx50:0, rtx40:0, rtx30:0, rtxOther:0, amdHigh:0, amdLow:0, integrated:0, unknown:0, skip:0 },
  };
  for (const [, entry] of phoneMap) {
    // 处理器分层
    const p = entry.proc;
    if (p === '(跳过)') dedupDevice.proc.skip++;
    else if (p.startsWith('不清楚')) dedupDevice.proc.unknown++;
    else if (p.includes('Elite') || p.includes('9400')) dedupDevice.proc.elite++;
    else if (p.includes('Gen3') || p.includes('9300')) dedupDevice.proc.gen3++;
    else if (p.includes('Gen1') || p.includes('Gen2') || p.includes('9200') || p.includes('870') || p.includes('888')) dedupDevice.proc.gen1_2++;
    else dedupDevice.proc.low++;

    // 内存分层
    const r = entry.ram;
    if (r === '(跳过)') dedupDevice.ram.skip++;
    else if (r === '不清楚') dedupDevice.ram.unknown++;
    else if (r.includes('16')) dedupDevice.ram.g16++;
    else if (r.includes('12')) dedupDevice.ram.g12++;
    else if (r.includes('8')) dedupDevice.ram.g8++;
    else if (r.includes('6')) dedupDevice.ram.g6++;
    else dedupDevice.ram.g4++;

    // 显卡分层（含 AMD 性能分级）
    const g = entry.gpu;
    if (g === '(跳过)') dedupDevice.gpu.skip++;
    else if (g.startsWith('不清楚')) dedupDevice.gpu.unknown++;
    else if (g.includes('RTX50')) dedupDevice.gpu.rtx50++;
    else if (g.includes('RTX40')) dedupDevice.gpu.rtx40++;
    else if (g.includes('RTX30')) dedupDevice.gpu.rtx30++;
    else if (g.includes('RTX')) dedupDevice.gpu.rtxOther++;
    else if (isAmdHighEnd(g)) dedupDevice.gpu.amdHigh++;
    else if (g.includes('AMD') || g.includes('Radeon') || g.includes('RX')) dedupDevice.gpu.amdLow++;
    else if (g.includes('集成')) dedupDevice.gpu.integrated++;
    else dedupDevice.gpu.unknown++;
  }

  // 按平台分用户数：答了处理器=手机用户，答了显卡=PC用户（可重叠）
  dedupDevice.mobileUsers = afterTotal - dedupDevice.proc.skip;
  dedupDevice.pcUsers    = afterTotal - dedupDevice.gpu.skip;

  // ——— 黄牛门禁：封禁可疑 IP ———
  const BLOCKED_IPS = [
    '27.29.247.107',   // 湖北孝感 — 25个手机号, 25个邮箱, 出生年份横跨17年
    '183.253.100.165', // 福建莆田 — 9个手机号, 全数字QQ邮箱前缀
  ];
  let scalperBlocked = 0;
  for (const [phone, entry] of phoneMap) {
    if (BLOCKED_IPS.some(bad => entry.ip.includes(bad))) {
      phoneMap.delete(phone);
      chCounts[entry.channel]--;
      scalperBlocked++;
    }
  }

  // 重新计算设备统计（黄牛过滤后）— 含 AMD 分级 + iOS + 高端合并
  const dedupDeviceClean = {
    proc: { elite:0, gen3:0, gen1_2:0, low:0, unknown:0, skip:0 },
    ram:  { g16:0, g12:0, g8:0, g6:0, g4:0, unknown:0, skip:0 },
    gpu:  { rtx50:0, rtx40:0, rtx30:0, rtxOther:0, amdHigh:0, amdLow:0, integrated:0, unknown:0, skip:0 },
  };
  let iosUsers = 0;
  let mobileHighEnd = 0;  // elite + gen3 + iOS（去重）
  let pcHighEnd = 0;      // RTX 30/40/50 + AMD高端（>= RTX 3060）
  let anyHighEnd = 0;     // 手机或PC任一满足高端

  for (const [, entry] of phoneMap) {
    // ── 处理器 ──
    const p = entry.proc;
    if (p === '(跳过)') dedupDeviceClean.proc.skip++;
    else if (p.startsWith('不清楚')) dedupDeviceClean.proc.unknown++;
    else if (p.includes('Elite') || p.includes('9400')) dedupDeviceClean.proc.elite++;
    else if (p.includes('Gen3') || p.includes('9300')) dedupDeviceClean.proc.gen3++;
    else if (p.includes('Gen1') || p.includes('Gen2') || p.includes('9200') || p.includes('870') || p.includes('888')) dedupDeviceClean.proc.gen1_2++;
    else dedupDeviceClean.proc.low++;

    // ── 内存 ──
    const r = entry.ram;
    if (r === '(跳过)') dedupDeviceClean.ram.skip++;
    else if (r === '不清楚') dedupDeviceClean.ram.unknown++;
    else if (r.includes('16')) dedupDeviceClean.ram.g16++;
    else if (r.includes('12')) dedupDeviceClean.ram.g12++;
    else if (r.includes('8')) dedupDeviceClean.ram.g8++;
    else if (r.includes('6')) dedupDeviceClean.ram.g6++;
    else dedupDeviceClean.ram.g4++;

    // ── 显卡（含 AMD 性能分级）──
    const g = entry.gpu;
    if (g === '(跳过)') dedupDeviceClean.gpu.skip++;
    else if (g.startsWith('不清楚')) dedupDeviceClean.gpu.unknown++;
    else if (g.includes('RTX50')) dedupDeviceClean.gpu.rtx50++;
    else if (g.includes('RTX40')) dedupDeviceClean.gpu.rtx40++;
    else if (g.includes('RTX30')) dedupDeviceClean.gpu.rtx30++;
    else if (g.includes('RTX')) dedupDeviceClean.gpu.rtxOther++;
    else if (isAmdHighEnd(g)) dedupDeviceClean.gpu.amdHigh++;
    else if (g.includes('AMD') || g.includes('Radeon') || g.includes('RX')) dedupDeviceClean.gpu.amdLow++;
    else if (g.includes('集成')) dedupDeviceClean.gpu.integrated++;
    else dedupDeviceClean.gpu.unknown++;

    // ── iOS ──
    const plat = entry.platform || '';
    if (plat.includes('iOS')) iosUsers++;

    // ── 手机高端 = 旗舰+高端处理器 OR iOS ──
    const isHighProc = p.includes('Elite') || p.includes('9400') || p.includes('Gen3') || p.includes('9300');
    if (isHighProc || plat.includes('iOS')) mobileHighEnd++;

    // ── PC高端 = RTX 30/40/50 + AMDHigh（>= RTX 3060）──
    const isHighGpu = g.includes('RTX50') || g.includes('RTX40') || g.includes('RTX30') || isAmdHighEnd(g);
    if (isHighGpu) pcHighEnd++;

    // ── 高端设备终筛 = 手机或PC任一满足 ──
    if (isHighProc || plat.includes('iOS') || isHighGpu) anyHighEnd++;
  }
  dedupDeviceClean.mobileUsers = phoneMap.size - dedupDeviceClean.proc.skip;
  dedupDeviceClean.pcUsers    = phoneMap.size - dedupDeviceClean.gpu.skip;
  dedupDeviceClean.iosUsers   = iosUsers;
  dedupDeviceClean.mobileHighEnd = mobileHighEnd;
  dedupDeviceClean.pcHighEnd     = pcHighEnd;
  dedupDeviceClean.anyHighEnd    = anyHighEnd;

  const finalTotal = phoneMap.size;

  return {
    beforeTotal,
    afterTotal,
    duplicates,
    retained: chCounts,
    dupRate: beforeTotal > 0 ? ((duplicates / beforeTotal) * 100).toFixed(1) : '0.0',
    dedupDevice: dedupDeviceClean,
    scalperBlocked,
    finalTotal,
    blockedIPs: BLOCKED_IPS,
  };
}

// ======================== 主流程 ========================
console.log('═'.repeat(60));
console.log('[1/3] 拉取数据...');
const downloads = CHANNELS.map(ch => ({ ...ch, csv: downloadCSV(ch.vid, ch.name) }));

console.log('\n[2/3] 执行数据清洗...');
const results = {};
downloads.forEach(ch => {
  const data = ch.source === 'xlsx' ? cleanSurveyGC(ch.csv?._xlsxData, ch.name) : cleanSurvey(ch.csv?.path, ch.name);
  if (data) {
    results[ch.key] = data;
    console.log(`  ${ch.name}: ${data.total} → 有效${data.valid} / 无效${data.invalid} (${data.rate}%)`);
  }
});

console.log('\n[3/3] 执行跨渠道去重...');
const dedup = dedupAcrossChannels(results);
const gcValid = results.gamecenter?.valid || 0;
console.log(`  三渠道去重前有效: ${dedup.beforeTotal.toLocaleString()}`);
console.log(`  跨渠道重复: ${dedup.duplicates.toLocaleString()} 人`);
console.log(`  三渠道去重后: ${dedup.afterTotal.toLocaleString()}`);
console.log(`  各渠道留存: TapTap ${dedup.retained.tap} / 好游 ${dedup.retained.haoyou} / 主站 ${dedup.retained.main}`);
console.log(`  GameCenter 直接叠加: +${gcValid.toLocaleString()} (无手机号)`);
dedup.gcValid = gcValid;
dedup.finalTotal = dedup.finalTotal + gcValid;
console.log(`  四渠道合计最终: ${dedup.finalTotal.toLocaleString()}`);

console.log('\n[4/4] 生成四渠道数据大屏...');
const html = generateCombinedHTML(results, dedup, REFRESH_MIN);
fs.writeFileSync(OUTPUT_HTML, html, 'utf-8');
console.log(`✅ 大屏已刷新: ${UPDATE_TIME}`);
console.log(`   文件: ${OUTPUT_HTML}`);

// 日志
const logEntry = `| ${UPDATE_TIME} | ${results.haoyou?.total||0} | ${results.haoyou?.valid||0} | ${results.tap?.total||0} | ${results.tap?.valid||0} | ${results.main?.total||0} | ${results.main?.valid||0} | ${results.gamecenter?.total||0} | ${results.gamecenter?.valid||0} |\n`;
const logHeader = '| 刷新时间 | 好游快爆-原始 | 有效 | TapTap-原始 | 有效 | 主站-原始 | 有效 | GameCenter-原始 | 有效 |\n|----------|-------------|------|------------|------|----------|------|---------------|------|\n';
if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, logHeader + logEntry, 'utf-8');
else fs.appendFileSync(LOG_FILE, logEntry, 'utf-8');

// ======================== HTML 模板 ========================
function generateCombinedHTML(data, dedup, intervalMin) {
  const chs = CHANNELS.map(ch => ({ ...ch, d: data[ch.key] }));
  const chs3 = chs.filter(c => !c.d?._gc); // 三渠道
  const gc = data.gamecenter;              // GameCenter 独立
  const totalAll = chs3.reduce((s, c) => s + (c.d?.total || 0), 0);
  const validAll = chs3.reduce((s, c) => s + (c.d?.valid || 0), 0);
  const invalidAll = totalAll - validAll;
  const rateAll = totalAll > 0 ? ((validAll / totalAll) * 100).toFixed(1) : '0.0';

  const catColors = { quality: '#4fc3f7', identity: '#66bb6a', device: '#ffa726' };
  const green = '#66bb6a', red = '#ef5350', blue = '#4fc3f7', orange = '#ffa726';

  // 每个渠道的图表数据 JSON
  const chartsData = {};
  chs.forEach(ch => {
    if (!ch.d) return;
    const isGC = ch.d._gc;
    chartsData[ch.key] = {
      total: ch.d.total, valid: ch.d.valid, invalid: ch.d.invalid, rate: ch.d.rate,
      ruleHits: ch.d.ruleHits, catHits: ch.d.catHits, platform: ch.d.platform, device: ch.d.device,
      name: ch.name, _gc: isGC,
      barRules: isGC ? [
        { name:'答题过快(<30s)',   val:ch.d.ruleHits.time_short||0, color:catColors.quality },
        { name:'答题超时(>6000s)', val:ch.d.ruleHits.time_long||0,  color:catColors.quality },
        { name:'陷阱题(射击类)',   val:ch.d.ruleHits.trap||0,       color:catColors.quality },
        { name:'放弃参与',        val:ch.d.ruleHits.abandon||0,     color:catColors.quality },
        { name:'Q6不清楚处理器',  val:ch.d.ruleHits.q9_proc||0,     color:catColors.device },
        { name:'Q7不清楚内存',    val:ch.d.ruleHits.q10_ram||0,     color:catColors.device },
        { name:'Q8 PC系统选其他', val:ch.d.ruleHits.os_other||0,    color:catColors.device },
      ] : [
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
  .overview-channels { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:14px; margin-bottom:18px; }
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
    <button class="tab" onclick="switchTab('tap')">📱 TapTap</button>
    <button class="tab" onclick="switchTab('haoyou')">🎮 好游快爆</button>
    <button class="tab" onclick="switchTab('main')">🌐 主站</button>
    <button class="tab" onclick="switchTab('gamecenter')">🕹️ GameCenter</button>
  </div>

  <!-- ==================== 总览面板 ==================== -->
  <div id="panel-overview">
    <div class="cards">
      <div class="card blue"><div class="num">${totalAll.toLocaleString()}</div><div class="label">三渠道原始答卷总数</div></div>
      <div class="card green"><div class="num">${validAll.toLocaleString()}</div><div class="label">三渠道有效答卷</div></div>
      <div class="card red"><div class="num">${invalidAll.toLocaleString()}</div><div class="label">三渠道剔除无效</div></div>
      <div class="card orange"><div class="num">${rateAll}%</div><div class="label">总有效回收率</div></div>
      <div class="card" style="border:2px solid #66bb6a;background:#0f2a1a;">
        <div class="num" style="color:#66bb6a;">${(dedup.dedupDevice.anyHighEnd || 0).toLocaleString()}</div>
        <div class="label">🎯 高端设备终筛</div>
        <div style="font-size:10px;color:#66bb6a;">${dedup.finalTotal > 0 ? ((dedup.dedupDevice.anyHighEnd || 0) / dedup.finalTotal * 100).toFixed(1) : '0.0'}% 手机或PC高端</div>
      </div>
    </div>

    <div class="chart-row" style="margin-bottom:18px;">
      <div class="chart-box full" style="background:#0f1923;border:1px solid #2a3a4a;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
          <div>
            <h3 style="font-size:14px;color:#fff;margin-bottom:4px;">🔗 跨渠道去重 → 🛡️ 黄牛门禁</h3>
            <p style="font-size:11px;color:#8899aa;">去重：按手机号匹配，TapTap &gt; 好游快爆 &gt; 主站 | 门禁：封禁可疑IP（湖北孝感/福建莆田黄牛）</p>
          </div>
          <div style="display:flex;gap:16px;text-align:center;flex-wrap:wrap;">
            <div><div style="font-size:22px;font-weight:bold;color:#4fc3f7;">${validAll.toLocaleString()}</div><div style="font-size:10px;color:#8899aa;">去重前有效</div></div>
            <div style="color:#667788;font-size:18px;align-self:center;">−</div>
            <div><div style="font-size:22px;font-weight:bold;color:#ef5350;">${dedup.duplicates.toLocaleString()}</div><div style="font-size:10px;color:#8899aa;">跨渠道重复</div></div>
            <div style="color:#667788;font-size:18px;align-self:center;">−</div>
            <div><div style="font-size:22px;font-weight:bold;color:#ffa726;">${dedup.scalperBlocked.toLocaleString()}</div><div style="font-size:10px;color:#8899aa;">🛡️黄牛拦截</div></div>
            <div style="color:#667788;font-size:18px;align-self:center;">=</div>
            <div><div style="font-size:28px;font-weight:bold;color:#66bb6a;">${dedup.finalTotal.toLocaleString()}</div><div style="font-size:10px;color:#8899aa;">最终可用用户</div></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 高端设备筛选 KPI — 手机 / PC 分开 -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px;">
      <!-- 手机高端 = 旗舰+高端处理器 OR iOS -->
      <div style="background:#1a2a3a;border:1px solid #42a5f5;border-radius:10px;padding:14px;">
        <h3 style="font-size:13px;color:#42a5f5;margin-bottom:10px;">📱 手机高端设备（门禁后 ${dedup.dedupDevice.mobileUsers.toLocaleString()} 人）</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
          <div class="mc" style="background:#0a1625;">
            <div class="n" style="color:#ce93d8;font-size:18px;">${(dedup.dedupDevice.proc.elite + dedup.dedupDevice.proc.gen3).toLocaleString()}</div>
            <div class="l">旗舰+高端处理器</div>
            <div style="font-size:10px;color:#ce93d8;">${dedup.dedupDevice.mobileUsers > 0 ? ((dedup.dedupDevice.proc.elite + dedup.dedupDevice.proc.gen3) / dedup.dedupDevice.mobileUsers * 100).toFixed(1) : '0.0'}%</div>
          </div>
          <div class="mc" style="background:#0a1625;">
            <div class="n" style="color:#ce93d8;font-size:18px;">${(dedup.dedupDevice.iosUsers || 0).toLocaleString()}</div>
            <div class="l">iOS 设备</div>
            <div style="font-size:10px;color:#ce93d8;">${dedup.dedupDevice.mobileUsers > 0 ? ((dedup.dedupDevice.iosUsers || 0) / dedup.dedupDevice.mobileUsers * 100).toFixed(1) : '0.0'}%</div>
          </div>
          <div class="mc" style="background:#0f1923;border:1px solid #66bb6a;">
            <div class="n" style="color:#66bb6a;font-size:22px;">${(dedup.dedupDevice.mobileHighEnd || 0).toLocaleString()}</div>
            <div class="l">✅ 手机高端合计</div>
            <div style="font-size:10px;color:#66bb6a;">${dedup.dedupDevice.mobileUsers > 0 ? ((dedup.dedupDevice.mobileHighEnd || 0) / dedup.dedupDevice.mobileUsers * 100).toFixed(1) : '0.0'}%</div>
          </div>
        </div>
      </div>
      <!-- PC高端 = RTX 30/40/50 + AMD中高端（>= RTX 3060） -->
      <div style="background:#1a2a3a;border:1px solid #5c6bc0;border-radius:10px;padding:14px;">
        <h3 style="font-size:13px;color:#5c6bc0;margin-bottom:10px;">🖥️ PC高端设备（门禁后 ${dedup.dedupDevice.pcUsers.toLocaleString()} 人）</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
          <div class="mc" style="background:#0a1625;">
            <div class="n" style="color:#ce93d8;font-size:18px;">${(dedup.dedupDevice.gpu.rtx50 + dedup.dedupDevice.gpu.rtx40 + dedup.dedupDevice.gpu.rtx30).toLocaleString()}</div>
            <div class="l">RTX 30/40/50 系列</div>
            <div style="font-size:10px;color:#ce93d8;">${dedup.dedupDevice.pcUsers > 0 ? ((dedup.dedupDevice.gpu.rtx50 + dedup.dedupDevice.gpu.rtx40 + dedup.dedupDevice.gpu.rtx30) / dedup.dedupDevice.pcUsers * 100).toFixed(1) : '0.0'}%</div>
          </div>
          <div class="mc" style="background:#0a1625;">
            <div class="n" style="color:#ce93d8;font-size:18px;">${(dedup.dedupDevice.gpu.amdHigh || 0).toLocaleString()}</div>
            <div class="l">AMD 中高端</div>
            <div style="font-size:10px;color:#ce93d8;">${dedup.dedupDevice.pcUsers > 0 ? ((dedup.dedupDevice.gpu.amdHigh || 0) / dedup.dedupDevice.pcUsers * 100).toFixed(1) : '0.0'}%</div>
          </div>
          <div class="mc" style="background:#0f1923;border:1px solid #66bb6a;">
            <div class="n" style="color:#66bb6a;font-size:22px;">${(dedup.dedupDevice.pcHighEnd || 0).toLocaleString()}</div>
            <div class="l">✅ PC高端合计</div>
            <div style="font-size:10px;color:#66bb6a;">${dedup.dedupDevice.pcUsers > 0 ? ((dedup.dedupDevice.pcHighEnd || 0) / dedup.dedupDevice.pcUsers * 100).toFixed(1) : '0.0'}%</div>
          </div>
        </div>
      </div>
    </div>

    <div class="overview-channels">
      ${chs3.map(ch => {
        if (!ch.d) return '';
        const cq = ch.d.catHits.quality || 0, ci = ch.d.catHits.identity || 0, cd = ch.d.catHits.device || 0;
        const mc = catColors;
        return `<div class="ov-card">
          <h3 style="color:${mc.quality}">${ch.name}</h3>
          <div class="mini-cards">
            <div class="mc"><div class="n" style="color:#4fc3f7">${(ch.d.total||0).toLocaleString()}</div><div class="l">原始答卷</div></div>
            <div class="mc"><div class="n" style="color:#66bb6a">${(ch.d.valid||0).toLocaleString()}</div><div class="l">有效答卷</div></div>
            <div class="mc"><div class="n" style="color:#ef5350">${(ch.d.invalid||0).toLocaleString()}</div><div class="l">剔除无效</div></div>
            <div class="mc"><div class="n" style="color:#ce93d8">${(dedup.retained[ch.key]||0).toLocaleString()}</div><div class="l">去重后留存</div></div>
          </div>
        </div>`;
      }).join('')}
      ${gc ? `
      <div class="ov-card" style="border:1px dashed #ffa726;">
        <h3 style="color:#ffa726;">🕹️ GameCenter（独立清洗）</h3>
        <div class="mini-cards">
          <div class="mc"><div class="n" style="color:#4fc3f7">${gc.total.toLocaleString()}</div><div class="l">原始答卷</div></div>
          <div class="mc"><div class="n" style="color:#66bb6a">${gc.valid.toLocaleString()}</div><div class="l">有效答卷</div></div>
          <div class="mc"><div class="n" style="color:#ef5350">${gc.invalid.toLocaleString()}</div><div class="l">剔除无效</div></div>
          <div class="mc"><div class="n" style="color:#ce93d8">${gc.valid.toLocaleString()}</div><div class="l">直接叠加</div></div>
        </div>
        <p style="font-size:10px;color:#ffa726;margin-top:6px;">⚠️ 独立清洗(7规则)，无手机号无法去重</p>
      </div>` : ''}
    </div>

    <div class="chart-row">
      <div class="chart-box full"><h3>三渠道对比 — 总览</h3><div id="ov-compare" style="height:340px;"></div></div>
    </div>
    <div class="chart-row triple">
      <div class="chart-box"><h3>答题质量低 命中对比</h3><div id="ov-quality" style="height:280px;"></div></div>
      <div class="chart-box"><h3>身份核验不符合要求 命中对比</h3><div id="ov-identity" style="height:280px;"></div></div>
      <div class="chart-box"><h3>设备甄别不符合要求 命中对比</h3><div id="ov-device" style="height:280px;"></div></div>
    </div>
    <div class="chart-row">
      <div class="chart-box full"><h3>参测设备平台分布（有效答卷）</h3><div id="ov-platform" style="height:320px;"></div></div>
    </div>
    <div class="chart-row triple">
      <div class="chart-box"><h3>手机处理器 旗舰/高端占比</h3><div id="ov-proc" style="height:300px;"></div></div>
      <div class="chart-box"><h3>PC显卡 RTX40/50占比</h3><div id="ov-gpu" style="height:300px;"></div></div>
      <div class="chart-box"><h3>运行内存 12G+占比</h3><div id="ov-ram" style="height:300px;"></div></div>
    </div>
  </div>

  <!-- ==================== 渠道详情面板 ==================== -->
  ${chs.map(ch => {
    if (!ch.d || !chartsData[ch.key] || ch.d._gc) return ''; // GameCenter 单独面板
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
    <div class="chart-row triple">
      <div class="chart-box"><h3>参测设备平台</h3><div id="plat-${ch.key}" style="height:280px;"></div></div>
      <div class="chart-box"><h3>三类规则命中占比</h3><div id="cat-${ch.key}" style="height:280px;"></div></div>
      <div class="chart-box"><h3>数据流</h3><div id="sankey-${ch.key}" style="height:280px;"></div></div>
    </div>
    <div class="chart-row">
      <div class="chart-box full"><h3>📱 手机处理器分布（高端→低端）</h3><div id="proc-${ch.key}" style="height:260px;"></div></div>
    </div>
    <div class="chart-row">
      <div class="chart-box"><h3>💾 手机运行内存</h3><div id="ram-${ch.key}" style="height:260px;"></div></div>
      <div class="chart-box"><h3>🖥️ PC 显卡分布</h3><div id="gpu-${ch.key}" style="height:260px;"></div></div>
    </div>
  </div>`;
  }).join('')}
  <!-- GameCenter 详情面板 -->
  ${(() => { const gc = results.gamecenter; if (!gc) return ''; return `
  <div id="panel-gamecenter" class="hidden">
    <div class="cards">
      <div class="card blue"><div class="num">${gc.total.toLocaleString()}</div><div class="label">原始答卷总数</div></div>
      <div class="card green"><div class="num">${gc.valid.toLocaleString()}</div><div class="label">清洗后有效答卷</div></div>
      <div class="card red"><div class="num">${gc.invalid.toLocaleString()}</div><div class="label">剔除无效答卷</div></div>
      <div class="card orange"><div class="num">${gc.rate}%</div><div class="label">有效回收率</div></div>
    </div>
    <div class="rule-box">
      <h3>📋 清洗规则（2 类 × 7 条）</h3>
      <div class="cat-section">
        <span class="cat-title quality">🔵 一、答题质量</span>
        <div class="rule-grid" style="grid-template-columns:1fr 1fr 1fr 1fr;">
          <div class="rule-item" style="border-left-color:#4fc3f7;"><span>答题过快</span><span style="font-size:9px;color:#8899aa;">&lt;30s</span><span class="hit" style="color:#81d4fa;">${gc.ruleHits.time_short||0}</span></div>
          <div class="rule-item" style="border-left-color:#4fc3f7;"><span>答题超时</span><span style="font-size:9px;color:#8899aa;">&gt;6000s</span><span class="hit" style="color:#81d4fa;">${gc.ruleHits.time_long||0}</span></div>
          <div class="rule-item" style="border-left-color:#4fc3f7;"><span>陷阱题</span><span style="font-size:9px;color:#8899aa;">Q15 H=射击类</span><span class="hit" style="color:#81d4fa;">${gc.ruleHits.trap||0}</span></div>
          <div class="rule-item" style="border-left-color:#4fc3f7;"><span>放弃参与</span><span style="font-size:9px;color:#8899aa;">选B</span><span class="hit" style="color:#81d4fa;">${gc.ruleHits.abandon||0}</span></div>
        </div>
      </div>
      <div class="cat-section" style="margin-bottom:0;">
        <span class="cat-title device">🟠 二、设备甄别</span>
        <div class="rule-grid">
          <div class="rule-item" style="border-left-color:#ffa726;"><span>Q6不清楚处理器</span><span style="font-size:9px;color:#8899aa;">选E</span><span class="hit" style="color:#ffcc80;">${gc.ruleHits.q9_proc||0}</span></div>
          <div class="rule-item" style="border-left-color:#ffa726;"><span>Q7不清楚内存</span><span style="font-size:9px;color:#8899aa;">选F</span><span class="hit" style="color:#ffcc80;">${gc.ruleHits.q10_ram||0}</span></div>
          <div class="rule-item" style="border-left-color:#ffa726;"><span>Q8 PC系统选其他</span><span style="font-size:9px;color:#8899aa;">D或E</span><span class="hit" style="color:#ffcc80;">${gc.ruleHits.os_other||0}</span></div>
        </div>
      </div>
    </div>
    <div class="chart-row">
      <div class="chart-box"><h3>有效 vs 无效</h3><div id="pie-gamecenter" style="height:300px;"></div></div>
      <div class="chart-box"><h3>各规则命中数</h3><div id="bar-gamecenter" style="height:300px;"></div></div>
    </div>
    <div class="chart-row triple">
      <div class="chart-box"><h3>📱 手机处理器</h3><div id="proc-gamecenter" style="height:280px;"></div></div>
      <div class="chart-box"><h3>💾 运行内存</h3><div id="ram-gamecenter" style="height:280px;"></div></div>
      <div class="chart-box"><h3>🖥️ 显卡分布</h3><div id="gpu-gamecenter" style="height:280px;"></div></div>
    </div>
    <p style="color:#8899aa;font-size:11px;margin-top:8px;">⚠️ 本渠道无手机号/邮箱/出生年月/IP，仅用5条规则清洗，无法跨渠道去重。GPU为自由文本需额外解析。</p>
  </div>`; })()}
</div>

<script>
var DATA = ${JSON.stringify(chartsData)};
var CHS = ${JSON.stringify(chs3.map(ch => ({ key:ch.key, name:ch.name })))};
var green='#66bb6a', red='#ef5350', blue='#4fc3f7', orange='#ffa726';
var catQuality='#4fc3f7', catIdentity='#66bb6a', catDevice='#ffa726';
var catColors = { quality: catQuality, identity: catIdentity, device: catDevice };
var refreshInterval = ${intervalMin};

// ====== Tab switch ======
function switchTab(key) {
  document.querySelectorAll('.tab').forEach(function(t){
    var names={overview:'总览',haoyou:'好游快爆',tap:'TapTap',main:'主站',gamecenter:'GameCenter'};
    t.classList.toggle('active', t.textContent.includes(names[key]||''));
  });
  ['overview','haoyou','tap','main','gamecenter'].forEach(function(k){
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

  // Device overview
  function devOverview(id, metric, labels, colors){
    var c = echarts.init(document.getElementById(id));
    c.setOption({
      tooltip:{trigger:'axis',axisPointer:{type:'shadow'}},
      legend:{data:labels,bottom:0,textStyle:{color:'#8899aa',fontSize:10}},
      grid:{left:2,right:8,bottom:30,top:8,containLabel:true},
      xAxis:{type:'category',data:chNames,axisLabel:{color:'#ccc',fontSize:10}},
      yAxis:{type:'value',axisLabel:{color:'#8899aa',fontSize:9},splitLine:{lineStyle:{color:'#1e3040'}}},
      series:labels.map(function(l,i){return {name:l,type:'bar',barWidth:24,itemStyle:{color:colors[i]},
        data:CHS.map(function(ch){return DATA[ch.key]?DATA[ch.key].device[metric[0]][metric[i+1]]:0;}),
        label:{show:true,position:'top',color:'#ccc',fontSize:8}};})
    });
  }
  devOverview('ov-proc', ['proc','elite','gen3'], ['旗舰(8Elite/9400+)','高端(8Gen3/9300)'], ['#00e676','#66bb6a']);
  devOverview('ov-gpu', ['gpu','rtx50','rtx40'], ['RTX 50系列','RTX 40系列'], ['#00e676','#66bb6a']);
  devOverview('ov-ram', ['ram','g16','g12'], ['16GB及以上','12GB'], ['#00e676','#66bb6a']);

  // Platform comparison
  var plat = echarts.init(document.getElementById('ov-platform'));
  plat.setOption({
    tooltip:{trigger:'axis',axisPointer:{type:'shadow'}},
    legend:{data:['PC','安卓','iOS'],bottom:0,textStyle:{color:'#8899aa',fontSize:11}},
    grid:{left:2,right:8,bottom:28,top:8,containLabel:true},
    xAxis:{type:'category',data:chNames,axisLabel:{color:'#ccc',fontSize:11}},
    yAxis:{type:'value',axisLabel:{color:'#8899aa',fontSize:10},splitLine:{lineStyle:{color:'#1e3040'}}},
    series:[
      {name:'PC',type:'bar',barWidth:28,itemStyle:{color:'#5c6bc0'},
       data:CHS.map(function(ch){return DATA[ch.key]?DATA[ch.key].platform.pc:0;}),
       label:{show:true,position:'top',color:'#ccc',fontSize:9}},
      {name:'安卓',type:'bar',barWidth:28,itemStyle:{color:'#66bb6a'},
       data:CHS.map(function(ch){return DATA[ch.key]?DATA[ch.key].platform.android:0;}),
       label:{show:true,position:'top',color:'#ccc',fontSize:9}},
      {name:'iOS',type:'bar',barWidth:28,itemStyle:{color:'#ef5350'},
       data:CHS.map(function(ch){return DATA[ch.key]?DATA[ch.key].platform.ios:0;}),
       label:{show:true,position:'top',color:'#ccc',fontSize:9}}
    ]
  });
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

  // Device detail charts
  var dev = d.device;

  // Processor bar
  var procChart = echarts.init(document.getElementById('proc-'+key));
  procChart.setOption({
    tooltip:{trigger:'axis',axisPointer:{type:'shadow'}},
    grid:{left:2,right:40,bottom:2,top:6,containLabel:true},
    xAxis:{type:'value',axisLabel:{color:'#8899aa',fontSize:9},splitLine:{lineStyle:{color:'#1e3040'}}},
    yAxis:{type:'category',data:['旗舰(8Elite/9400+)','高端(8Gen3/9300)','中高端(Gen1-2/9200)','中端(865/9000及以下)','不清楚配置','(PC用户)'].reverse(),
      axisLabel:{color:'#ccc',fontSize:9},axisLine:{show:false},axisTick:{show:false},inverse:true},
    series:[{type:'bar',
      data:[dev.proc.elite,dev.proc.gen3,dev.proc.gen1_2,dev.proc.low,dev.proc.unknown,dev.proc.skip].reverse().map(function(v,i){
        return {value:v,itemStyle:{color:['#00e676','#66bb6a','#ffa726','#ef5350','#9e9e9e','#37474f'][i]}};
      }),barWidth:18,label:{show:true,position:'right',color:'#ccc',fontSize:9,formatter:function(p){return p.value>0?p.value:'';}},
      itemStyle:{borderRadius:[0,3,3,0]}}]
  });

  // RAM bar
  var ramChart = echarts.init(document.getElementById('ram-'+key));
  ramChart.setOption({
    tooltip:{trigger:'axis',axisPointer:{type:'shadow'}},
    grid:{left:2,right:35,bottom:2,top:6,containLabel:true},
    xAxis:{type:'value',axisLabel:{color:'#8899aa',fontSize:9},splitLine:{lineStyle:{color:'#1e3040'}}},
    yAxis:{type:'category',data:['16GB及以上','12GB','8GB','6GB','4GB及以下','不清楚','(PC用户)'].reverse(),
      axisLabel:{color:'#ccc',fontSize:9},axisLine:{show:false},axisTick:{show:false},inverse:true},
    series:[{type:'bar',
      data:[dev.ram.g16,dev.ram.g12,dev.ram.g8,dev.ram.g6,dev.ram.g4,dev.ram.unknown,dev.ram.skip].reverse().map(function(v,i){
        return {value:v,itemStyle:{color:['#00e676','#66bb6a','#ffa726','#ef6c00','#ef5350','#9e9e9e','#37474f'][i]}};
      }),barWidth:16,label:{show:true,position:'right',color:'#ccc',fontSize:9,formatter:function(p){return p.value>0?p.value:'';}},
      itemStyle:{borderRadius:[0,3,3,0]}}]
  });

  // GPU bar
  var gpuChart = echarts.init(document.getElementById('gpu-'+key));
  gpuChart.setOption({
    tooltip:{trigger:'axis',axisPointer:{type:'shadow'}},
    grid:{left:2,right:35,bottom:2,top:6,containLabel:true},
    xAxis:{type:'value',axisLabel:{color:'#8899aa',fontSize:9},splitLine:{lineStyle:{color:'#1e3040'}}},
    yAxis:{type:'category',data:['RTX 50系列','RTX 40系列','RTX 30系列','RTX 20及以下','AMD显卡','集成显卡','不清楚','(手机用户)'].reverse(),
      axisLabel:{color:'#ccc',fontSize:9},axisLine:{show:false},axisTick:{show:false},inverse:true},
    series:[{type:'bar',
      data:[dev.gpu.rtx50,dev.gpu.rtx40,dev.gpu.rtx30,dev.gpu.rtxOther,dev.gpu.amd,dev.gpu.integrated,dev.gpu.unknown,dev.gpu.skip].reverse().map(function(v,i){
        return {value:v,itemStyle:{color:['#00e676','#66bb6a','#ffa726','#ef6c00','#ce93d8','#42a5f5','#9e9e9e','#37474f'][i]}};
      }),barWidth:16,label:{show:true,position:'right',color:'#ccc',fontSize:9,formatter:function(p){return p.value>0?p.value:'';}},
      itemStyle:{borderRadius:[0,3,3,0]}}]
  });

  // Platform pie
  var platChart = echarts.init(document.getElementById('plat-'+key));
  platChart.setOption({
    tooltip:{trigger:'item',formatter:'{b}: {c} 人 ({d}%)'},
    series:[{type:'pie',radius:['45%','72%'],center:['50%','50%'],itemStyle:{borderRadius:4,borderColor:'#0f1923',borderWidth:2},label:{color:'#ccc',fontSize:10,formatter:'{b}\\n{d}%'},data:[
      {value:d.platform.pc,name:'PC',itemStyle:{color:'#5c6bc0'}},
      {value:d.platform.android,name:'安卓',itemStyle:{color:'#66bb6a'}},
      {value:d.platform.ios,name:'iOS',itemStyle:{color:'#ef5350'}},
    ].filter(function(x){return x.value>0;})}]
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
  ['ov-compare','ov-quality','ov-identity','ov-device','ov-platform','ov-proc','ov-gpu','ov-ram'].forEach(function(id){
    var el=document.getElementById(id); if(el && el.clientWidth>0) echarts.getInstanceByDom(el)?.resize();
  });
  CHS.forEach(function(ch){
    ['pie-','bar-','plat-','cat-','sankey-','proc-','ram-','gpu-'].forEach(function(pre){
      var el=document.getElementById(pre+ch.key); if(el && el.clientWidth>0) echarts.getInstanceByDom(el)?.resize();
    });
  });
});
</script>
</body>
</html>`;
}
