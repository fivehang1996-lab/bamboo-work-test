// TapTap 小分页下载（避免 OSS 超时）
const fs = require('fs');
const { execSync } = require('child_process');

const VID = '362635200';
const OUTPUT = 'D:\\claude\\问卷数据\\焕梦_TapTap_原始.csv';
const PAGE_SIZE = 1500;

const cntRes = JSON.parse(execSync(`wjx response count --vid ${VID} --json`, { encoding: 'utf-8' }));
const total = cntRes?.data?.join_times || 0;
console.log(`TapTap 总数: ${total}`);

const pages = Math.ceil(total / PAGE_SIZE);
const csvFiles = [];
let headerLine = '';

for (let p = 0; p < pages; p++) {
  const minIdx = p * PAGE_SIZE;
  const qCount = Math.min(PAGE_SIZE, total - minIdx);
  console.log(`分页 ${p+1}/${pages}: min=${minIdx} count=${qCount}`);

  let ok = false;
  for (let retry = 3; retry > 0 && !ok; retry--) {
    try {
      const res = JSON.parse(execSync(`wjx response download --vid ${VID} --suffix 0 --query_count ${qCount} --min_index ${minIdx} --json`, { encoding: 'utf-8', timeout: 120000 }));
      if (!res.data?.download_url) throw new Error('无下载链接');
      const tmpPath = OUTPUT + '.part' + p;
      execSync(`powershell -Command "Invoke-WebRequest -Uri '${res.data.download_url}' -OutFile '${tmpPath}'"`, { timeout: 300000 });
      csvFiles.push(tmpPath);
      if (p === 0) {
        let raw = fs.readFileSync(tmpPath, 'utf-8');
        if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
        headerLine = raw.split('\n')[0];
      }
      ok = true;
      console.log(`  成功`);
    } catch(e) {
      console.log(`  重试${4-retry}/3: ${e.message.substring(0,100)}`);
      if (retry > 1) { execSync('powershell -Command "Start-Sleep 5"'); }
    }
  }
  if (!ok) { console.log(`  分页 ${p+1} 最终失败`); }
}

if (csvFiles.length === 0) { console.log('全部失败'); process.exit(1); }

const allLines = [headerLine];
csvFiles.forEach(f => {
  let raw = fs.readFileSync(f, 'utf-8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  const lines = raw.split('\n').filter(l => l.trim());
  for (let i = 1; i < lines.length; i++) allLines.push(lines[i]);
  fs.unlinkSync(f);
});
fs.writeFileSync(OUTPUT, '﻿' + allLines.join('\n'), 'utf-8');
console.log(`合并完成: ${allLines.length - 1} 行`);
