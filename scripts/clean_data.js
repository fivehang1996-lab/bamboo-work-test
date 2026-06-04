// 清洗脚本：焕梦测试-好游快爆招募问卷
// 规则1: 答题时间 < 60秒 或 > 6000秒 → 无效
// 规则2: 陷阱题(第18题)选了"游戏类型（射击类）" → 无效

const fs = require('fs');
const path = require('path');

const INPUT = 'D:\\claude\\焕梦好游快爆_原始.csv';
const OUTPUT = 'D:\\claude\\焕梦好游快爆_清洗后.csv';
const REPORT_PATH = 'D:\\claude\\清洗报告.md';

// 读取文件（UTF-8 with BOM）
let raw = fs.readFileSync(INPUT, 'utf-8');
if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);

const lines = raw.split('\n').filter(l => l.trim());
const header = lines[0];

// 找到关键列索引
const cols = header.split(',');
console.log('列名列表:');
cols.forEach((c, i) => console.log(`  [${i}] ${c}`));

// 所用时间 列
const timeColIdx = cols.findIndex(c => c.includes('所用时间'));
// 陷阱题列：第18题
const trapColIdx = cols.findIndex(c => c.includes('18、'));

console.log(`\n所用时间列索引: ${timeColIdx} (${cols[timeColIdx]})`);
console.log(`陷阱题列索引: ${trapColIdx} (${cols[trapColIdx]})\n`);

// 解析所用时间（格式："71秒"）
function parseSeconds(val) {
  if (!val) return null;
  const match = val.match(/^(\d+)\s*秒?$/);
  return match ? parseInt(match[1], 10) : null;
}

// 解析CSV行（处理引号内逗号）
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

let total = 0;
let invalidTime = 0;
let invalidTrap = 0;
let invalidBoth = 0;
let validRows = [];
let timeDetails = []; // for report

for (let i = 1; i < lines.length; i++) {
  const row = parseCSVLine(lines[i]);
  if (row.length < Math.max(timeColIdx, trapColIdx) + 1) continue;

  total++;
  const timeStr = row[timeColIdx];
  const seconds = parseSeconds(timeStr);
  const trapAnswer = row[trapColIdx] || '';

  const timeInvalid = seconds !== null && (seconds < 60 || seconds > 6000);
  const trapInvalid = trapAnswer.includes('射击类');

  if (timeInvalid && trapInvalid) {
    invalidBoth++;
    timeDetails.push({ row: i + 1, seconds, trap: trapAnswer, reason: 'both' });
  } else if (timeInvalid) {
    invalidTime++;
    timeDetails.push({ row: i + 1, seconds, trap: '', reason: 'time' });
  } else if (trapInvalid) {
    invalidTrap++;
    timeDetails.push({ row: i + 1, seconds, trap: trapAnswer, reason: 'trap' });
  } else {
    validRows.push(lines[i]);
  }
}

// 写清洗后文件
const cleanedContent = [header, ...validRows].join('\n');
fs.writeFileSync(OUTPUT, '﻿' + cleanedContent, 'utf-16le');

const valid = validRows.length;
const invalid = invalidTime + invalidTrap + invalidBoth;

// 生成报告
const report = `# 清洗报告 — 焕梦测试招募问卷（好游快爆）

**原始文件**: 焕梦好游快爆_原始.csv
**清洗后文件**: 焕梦好游快爆_清洗后.csv
**清洗日期**: ${new Date().toLocaleString('zh-CN')}

---

## 清洗规则

| 规则 | 条件 | 判定 |
|------|------|------|
| 1 | 答题时间 < 60 秒 | 无效（过快） |
| 2 | 答题时间 > 6000 秒 | 无效（异常） |
| 3 | 陷阱题「请问您主要是被《绿梦：时空之声》的哪些方面吸引」选了"游戏类型（射击类）" | 无效（《绿梦》非射击游戏） |

---

## 统计总览

| 指标 | 数量 | 占比 |
|------|------|------|
| 原始答卷 | **${total}** | 100% |
| 有效答卷 | **${valid}** | **${((valid/total)*100).toFixed(1)}%** |
| 无效答卷 | **${invalid}** | **${((invalid/total)*100).toFixed(1)}%** |
| ├ 仅答题时间无效 | ${invalidTime} | ${((invalidTime/total)*100).toFixed(1)}% |
| ├ 仅陷阱题无效 | ${invalidTrap} | ${((invalidTrap/total)*100).toFixed(1)}% |
| └ 两项均无效 | ${invalidBoth} | ${((invalidBoth/total)*100).toFixed(1)}% |

---

## 答题时间分布（无效部分）

${(() => {
  const timeInvalidOnes = timeDetails.filter(d => d.reason === 'time' || d.reason === 'both');
  if (timeInvalidOnes.length === 0) return '无时间异常答卷。';
  const timeVals = timeInvalidOnes.map(d => d.seconds).filter(s => s !== null);
  const min = Math.min(...timeVals);
  const max = Math.max(...timeVals);
  const under60 = timeVals.filter(s => s < 60).length;
  const over6000 = timeVals.filter(s => s > 6000).length;
  return `- 小于 60 秒: ${under60} 份
- 大于 6000 秒: ${over6000} 份
- 最短: ${min} 秒 | 最长: ${max} 秒`;
})()}

---

## 结论

清洗后保留 **${valid}** 份有效答卷，剔除 **${invalid}** 份无效答卷，有效回收率 **${((valid/total)*100).toFixed(1)}%**。
`;

fs.writeFileSync(REPORT_PATH, '﻿' + report, 'utf-8');
console.log(report);
console.log(`\n文件已写入: ${OUTPUT}`);
console.log(`报告已写入: ${REPORT_PATH}`);
