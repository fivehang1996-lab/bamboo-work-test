// ============================================================
// 焕梦测试·好游快爆 数据清洗脚本 v2
// 规则: 时间(2) + 陷阱题(1) + 年龄(1) + 格式校验(3) + 不清楚选项(3)
// ============================================================

const fs = require('fs');

const INPUT  = 'D:\\claude\\问卷数据\\焕梦好游快爆_原始.csv';
const OUTPUT = 'D:\\claude\\问卷数据\\焕梦好游快爆_清洗后_v2.csv';
const REPORT = 'D:\\claude\\问卷数据\\清洗报告_v2.md';

const NOW = new Date(2026, 5, 4); // 2026-06-04
const NOW_YEAR = NOW.getFullYear();
const NOW_MONTH = NOW.getMonth() + 1; // 6

// ======================== 工具函数 ========================

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

function parseSeconds(val) {
  if (!val) return null;
  const m = val.match(/^(\d+)\s*秒?$/);
  return m ? parseInt(m[1], 10) : null;
}

/** 从 "YYYY-MM" 算年龄 */
function calcAge(birth) {
  if (!birth) return null;
  const m = birth.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  let age = NOW_YEAR - y;
  if (NOW_MONTH < mo) age--;
  return age;
}

/** 校验手机号: 11位, 1开头, 全数字 */
function isValidPhone(phone) {
  if (!phone || !phone.trim()) return false;
  const s = phone.trim();
  return /^1\d{10}$/.test(s);
}

/** 校验邮箱: 含@, 前后非空, 域名含点 */
function isValidEmail(email) {
  if (!email || !email.trim()) return false;
  const s = email.trim();
  const at = s.indexOf('@');
  if (at <= 0 || at === s.length - 1) return false;
  const domain = s.substring(at + 1);
  return domain.includes('.') && domain.indexOf('.') < domain.length - 1;
}

/** 校验好游快爆ID: 非空, 纯数字 */
function isValidAccountId(id) {
  if (!id || !id.trim()) return false;
  const s = id.trim();
  return /^\d+$/.test(s);
}

// ======================== 主流程 ========================

let raw = fs.readFileSync(INPUT, 'utf-8');
if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);

const lines = raw.split('\n').filter(l => l.trim());
const header = lines[0];
const cols = header.split(',');
console.log('列数:', cols.length);

// 列索引
const idx = {
  id:          cols.findIndex(c => c.includes('好游快爆账号ID')),       // Q2
  birth:       cols.findIndex(c => c.includes('出生年月')),              // Q3
  time:        cols.findIndex(c => c.includes('所用时间')),
  processor:   cols.findIndex(c => c.includes('手机处理器')),            // Q9
  ram:         cols.findIndex(c => c.includes('运行内存')),              // Q10
  os:          cols.findIndex(c => c.includes('PC设备的系统版本')),       // Q11
  trap:        cols.findIndex(c => c.includes('18、')),                 // Q18 trap
  phone:       cols.findIndex(c => c.includes('手机号码')),              // Q19
  email:       cols.findIndex(c => c.includes('邮箱')),                 // Q20
};

console.log('列索引:', JSON.stringify(idx, null, 2));

// 规则定义: { key, label, check(row) }
const rules = [
  {
    key: 'time_short',
    label: '答题过快(<60s)',
    check: r => { const s = parseSeconds(r[idx.time]); return s !== null && s < 60; }
  },
  {
    key: 'time_long',
    label: '答题超时(>6000s)',
    check: r => { const s = parseSeconds(r[idx.time]); return s !== null && s > 6000; }
  },
  {
    key: 'trap_shooter',
    label: '陷阱题-射击类',
    check: r => (r[idx.trap] || '').includes('射击类')
  },
  {
    key: 'age',
    label: '年龄不在18~100岁',
    check: r => { const a = calcAge(r[idx.birth]); return a !== null && (a < 18 || a > 100); }
  },
  {
    key: 'phone',
    label: '手机号格式错误',
    check: r => !isValidPhone(r[idx.phone])
  },
  {
    key: 'email',
    label: '邮箱格式错误',
    check: r => !isValidEmail(r[idx.email])
  },
  {
    key: 'account_id',
    label: '好游快爆ID格式错误',
    check: r => !isValidAccountId(r[idx.id])
  },
  {
    key: 'q9_unknown',
    label: 'Q9-不清楚处理器配置',
    check: r => {
      const v = (r[idx.processor] || '').trim();
      return v.startsWith('不清楚具体配置');
    }
  },
  {
    key: 'q10_unknown',
    label: 'Q10-不清楚运行内存',
    check: r => {
      const v = (r[idx.ram] || '').trim();
      return v === '不清楚';
    }
  },
  {
    key: 'q11_other_os',
    label: 'Q11-其他操作系统',
    check: r => {
      const v = (r[idx.os] || '').trim();
      return v === '其他 Windows 系统' || v === '其他操作系统（如 Linux、鸿蒙）';
    }
  },
];

// 统计
const ruleHits = {};        // rule -> count
rules.forEach(r => { ruleHits[r.key] = 0; });

let total = 0;
let validCount = 0;
const validRows = [];
const invalidDetails = [];  // { row, reasons[], detail{} }

for (let i = 1; i < lines.length; i++) {
  const row = parseCSVLine(lines[i]);
  if (row.length < 20) continue;
  total++;

  const failed = rules.filter(r => r.check(row)).map(r => r.key);

  if (failed.length === 0) {
    validCount++;
    validRows.push(lines[i]);
  } else {
    failed.forEach(k => { ruleHits[k]++; });
    invalidDetails.push({
      row: i + 1,
      reasons: failed,
      detail: {
        time: row[idx.time],
        birth: row[idx.birth],
        age: calcAge(row[idx.birth]),
        phone: row[idx.phone],
        email: row[idx.email],
        accountId: row[idx.id],
        processor: (row[idx.processor] || '').substring(0, 60),
        ram: row[idx.ram],
        os: row[idx.os],
        trap: (row[idx.trap] || '').substring(0, 50),
      }
    });
  }
}

const invalidTotal = total - validCount;

// ======================== 输出 ========================

// 写清洗后 CSV
const cleanedContent = [header, ...validRows].join('\n');
fs.writeFileSync(OUTPUT, '﻿' + cleanedContent, 'utf-16le');

// 生成报告
const ruleReport = rules.map(r => {
  const hits = ruleHits[r.key];
  return `| ${r.label} | ${hits} | ${((hits/total)*100).toFixed(1)}% |`;
}).join('\n');

// 无效原因交叉统计
const reasonCombo = {};
invalidDetails.forEach(d => {
  const key = d.reasons.sort().join('+');
  reasonCombo[key] = (reasonCombo[key] || 0) + 1;
});
const comboReport = Object.entries(reasonCombo)
  .sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `| ${k} | ${v} | ${((v/invalidTotal)*100).toFixed(1)}% |`)
  .join('\n');

const report = `# 清洗报告 v2 — 焕梦测试招募问卷（好游快爆）

**原始文件**: 焕梦好游快爆_原始.csv
**清洗后文件**: 焕梦好游快爆_清洗后_v2.csv
**清洗日期**: 2026-06-04

---

## 清洗规则（共 10 条）

| # | 规则 | 判定条件 |
|---|------|----------|
| 1 | 答题过快 | 所用时间 < 60 秒 |
| 2 | 答题超时 | 所用时间 > 6000 秒 |
| 3 | 陷阱题 | Q18「吸引您的方面」选择"游戏类型（射击类）" |
| 4 | 年龄不符 | 出生年月计算年龄 < 18 或 > 100 岁 |
| 5 | 手机号 | 非11位 / 非1开头 / 含非数字字符 |
| 6 | 邮箱 | 不含 @ / @前后为空 / 域名无点 |
| 7 | 好游快爆ID | 为空 / 非纯数字 |
| 8 | Q9不清楚 | 手机处理器选择"不清楚具体配置" |
| 9 | Q10不清楚 | 手机运行内存选择"不清楚" |
| 10 | Q11其他OS | PC系统选"其他 Windows 系统"或"其他操作系统" |

---

## 总览

| 指标 | 数量 | 占比 |
|------|------|------|
| 原始答卷 | **${total}** | 100% |
| 有效答卷 | **${validCount}** | **${((validCount/total)*100).toFixed(1)}%** |
| 无效答卷 | **${invalidTotal}** | **${((invalidTotal/total)*100).toFixed(1)}%** |

---

## 各规则命中统计

| 规则 | 命中数 | 命中率 |
|------|--------|--------|
${ruleReport}

---

## 无效原因组合（重叠情况）

| 命中规则组合 | 人数 | 占无效比 |
|-------------|------|----------|
${comboReport}

---

## 无效样本抽查（前 15 条）

| 原始行 | 时间 | 年龄 | 手机号 | 邮箱 | ID | Q9处理器 | Q10内存 | Q11系统 | 陷阱题 | 命中规则 |
|--------|------|------|--------|------|----|----------|---------|---------|--------|----------|
${invalidDetails.slice(0, 15).map(d => {
  return `| ${d.row} | ${d.detail.time} | ${d.detail.age ?? '?'} | ${d.detail.phone} | ${d.detail.email} | ${d.detail.accountId} | ${d.detail.processor} | ${d.detail.ram} | ${d.detail.os} | ${d.detail.trap} | ${d.reasons.join(', ')} |`;
}).join('\n')}

---

## 结论

v2 在 v1 基础上新增 7 条规则（年龄、手机、邮箱、ID、Q9/Q10/Q11），共 10 条规则。
清洗后保留 **${validCount}** 份，剔除 **${invalidTotal}** 份，有效回收率 **${((validCount/total)*100).toFixed(1)}%**。
`;

fs.writeFileSync(REPORT, '﻿' + report, 'utf-8');
console.log(report);
console.log(`\n有效: ${validCount} | 无效: ${invalidTotal} | 有效率: ${((validCount/total)*100).toFixed(1)}%`);
console.log(`文件已写入: ${OUTPUT}`);
console.log(`报告已写入: ${REPORT}`);
