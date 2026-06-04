
function $(id){return document.getElementById(id);}
function H(a){return a.join('');}
var D=[];
function S(c,d,n,h){D.push({chapter:c,duration:d,narration:n,html:h});}
function T(l,c){return '<span class="tag t'+c+'">'+l+'</span>';}
function IC(icon,name,desc,color,tag){var t=tag?'<div style="margin-top:5px;">'+tag+'</div>':'';return '<div class="cluster-card ar" style="border-top:3px solid var(--'+color+');"><div class="cc-icon">'+icon+'</div><div class="cc-name" style="color:var(--'+color+');">'+name+'</div><div class="cc-desc">'+desc+'</div>'+t+'</div>';}
function DN(pct,color,val,lbl,leg){return '<div class="donut-item"><div class="donut" style="background:conic-gradient('+color+' 0% '+pct+'%, rgba(255,255,255,.04) '+pct+'% 100%);"><div class="val" style="color:'+color+';">'+val+'</div></div><div class="lbl">'+lbl+'</div><div class="leg">'+leg+'</div></div>';}
function BR(label,pct,color,note){return '<div class="bar-row"><span class="bar-label">'+label+'</span><div class="bar-track"><div class="bar-fill" style="width:'+pct+'%;background:'+color+';">'+note+'</div></div></div>';}

// ======================== SCENES ========================

// 0 — Title
S('开篇',6,
  '绿梦蚀梦测试结束后，我们把后台活跃数据和问卷数据做了交叉匹配。三组玩家、五类聚类、两个流失节点。今天这份报告回答三个问题——谁更容易流失、为什么流失、怎么优化。',
  H([
    '<div class="card ca as" style="text-align:center;padding:38px;">',
      '<div style="font-size:.74em;color:var(--accent);letter-spacing:.1em;margin-bottom:10px;font-weight:600;">蚀梦测试 · 玩家流失分析</div>',
      '<h1 style="font-size:2.6em;">前期流失玩家研究</h1>',
      '<p style="font-size:1.05em;color:var(--text2);">后台活跃数据 × 问卷调研数据 · 交叉匹配</p>',
      '<div class="divider"></div>',
      '<div class="stat-row" style="margin-top:10px;">',
        '<div class="stat-item"><div class="sv" style="color:var(--accent);">3</div><div class="sl">玩家分层</div></div>',
        '<div class="stat-item"><div class="sv" style="color:var(--purple);">5</div><div class="sl">核心群体</div></div>',
        '<div class="stat-item"><div class="sv" style="color:var(--yellow);">2</div><div class="sl">流失节点</div></div>',
        '<div class="stat-item"><div class="sv" style="color:var(--green);">3</div><div class="sl">优化方向</div></div>',
      '</div>',
    '</div>'
  ])
);

// 1 — Definitions
S('开篇',7,
  '先对齐定义。留存玩家活跃天数大于等于六天，贯穿测试期。次日流失第一天登录后第二天就走了。三日流失扛到第二天但第三天也离开了。三组人的画像和行为差异，是整份报告的核心线索。',
  H([
    '<h2>玩家分层定义</h2>',
    '<div class="grid-3">',
      '<div class="compare-col ar" style="text-align:center;border-top:3px solid var(--green);"><div style="font-size:2.4em;color:var(--green);">>= 6天</div><div style="font-weight:700;font-size:1.05em;margin-top:4px;">留存玩家</div><div style="font-size:.8em;color:var(--text2);margin-top:4px;">持续体验的稳定群体<br>'+T('基准对照组','g')+'</div></div>',
      '<div class="compare-col ar1" style="text-align:center;border-top:3px solid var(--yellow);"><div style="font-size:2.4em;color:var(--yellow);">Day 1</div><div style="font-weight:700;font-size:1.05em;margin-top:4px;">'+T('次日流失','y')+'</div><div style="font-size:.8em;color:var(--text2);margin-top:4px;">活跃天数=1，第二日流失<br>'+T('首日印象决定去留','y')+'</div></div>',
      '<div class="compare-col ar2" style="text-align:center;border-top:3px solid var(--red);"><div style="font-size:2.4em;color:var(--red);">Day 2</div><div style="font-weight:700;font-size:1.05em;margin-top:4px;">'+T('三日流失','r')+'</div><div style="font-size:.8em;color:var(--text2);margin-top:4px;">活跃天数=2，第三日流失<br>'+T('深度体验暴露问题','r')+'</div></div>',
    '</div>'
  ])
);

// 2 — Who churns: DONUT CHARTS (from colleague)
S('Q1 · 谁更容易流失',10,
  '先看人口学和设备特征。女性玩家次日流失比例偏高。年龄上，18到25岁留存率最高，36岁以上三日流失突出。城市上，低线城市留存率更高。设备上，PC端明显优于移动端，双端玩家留存最好。',
  H([
    '<h2>流失人群画像 — 人口学 & 设备</h2>',
    '<div class="card ar" style="padding:22px;">',
      '<h3 style="color:var(--muted);font-size:.82em;margin-bottom:12px;">人口学特征对比</h3>',
      '<div class="donut-wrap">',
        DN('58','#ec4899','↑','女性玩家','次日流失比例偏高'),
        DN('72','#10b981','72%','18~25岁','留存率最高'),
        DN('48','#f43f5e','↑','36岁以上','三日流失突出'),
        DN('78','#6366f1','✓','PC > 移动','双端留存最佳'),
        DN('62','#6366f1','✓','低线城市','留存率相对更高'),
      '</div>',
    '</div>',
    '<div class="insight ar4" style="margin-top:8px;"><strong style="color:var(--accent);">关键发现：</strong>有银恶类游戏经验的玩家留存率最高；无二游经验者更易流失。</div>'
  ])
);

// 3 — Motivation × retention
S('Q1 · 长期诉求 × 留存',9,
  '从长期诉求看，玩家分成五类。剧情党留存最好，他们由内容沉浸感驱动。强度党次日流失突出——首日没有足够内容让他们感知养成价值。操作高玩党三日流失偏高——战斗期待没有被兑现。还有一个值得警惕的信号：初印象好评的玩家，在第三日流失的比例反而显著更高。',
  H([
    '<h2>五类玩家 × 流失风险</h2>',
    '<div class="grid-3">',
      '<div class="compare-col ar" style="text-align:center;border-top:3px solid var(--green);"><div style="font-weight:700;color:var(--green);">📖 剧情党</div><div style="font-size:.82em;color:var(--text2);margin-top:4px;">'+T('留存最好','g')+'<br>看重剧情和探索<br>PC端+一二线城市占比高</div></div>',
      '<div class="compare-col ar1" style="text-align:center;border-top:3px solid var(--red);"><div style="font-weight:700;color:var(--red);">👑 强度党</div><div style="font-size:.82em;color:var(--text2);margin-top:4px;">'+T('次日流失突出','r')+'<br>追求版本最强配队<br>移动端+低线城市占比高</div></div>',
      '<div class="compare-col ar2" style="text-align:center;border-top:3px solid var(--yellow);"><div style="font-weight:700;color:var(--yellow);">⚔️ 操作高玩党</div><div style="font-size:.82em;color:var(--text2);margin-top:4px;">'+T('三日流失偏高','y')+'<br>追求操作与挑战<br>PC端+银恶经验丰富</div></div>',
    '</div>',
    '<div class="hl-box ar3" style="margin-top:10px;text-align:center;"><strong style="color:var(--red);">⚠️ 初印象好评 ≠ 不流失：</strong>初印象好评玩家在第三日流失比例<strong style="color:var(--red);">显著更高</strong>——两天体验后确实未达预期。</div>'
  ])
);

// 4 — Five clusters
S('聚类 · 五类玩家画像',11,
  '展开看五类玩家的完整画像。剧情党一二线多PC端。操作高玩党银恶和卷轴格斗经验最丰富。解谜成就党由完成度驱动。厨力党年轻人为主移动端多。强度党低线城市多、ARPG经验丰富。每类群体的差异化特征不仅仅是"看重什么"，还关联到人口、设备、经验和风险。',
  H([
    '<h2>五类玩家完整画像</h2>',
    '<div class="grid-5">',
      IC('📖','剧情党','看重剧情和探索<br>追求内容沉浸感<br>一二线城市占比高<br>PC端占比更大','accent',T('留存最好','g')),
      IC('⚔️','操作高玩党','看重挑战和操作<br>注重策略性<br>PC端占比更大<br>银恶+卷轴经验最多','red',T('三日流失偏高','y')),
      IC('🧩','解谜成就党','看重解谜和成就收集<br>同时注重探索<br>内容完成度驱动','purple'),
      IC('💜','厨力党','由情感驱动抽卡养角色<br>18-25岁占比高<br>移动端占比更大','pink'),
      IC('👑','强度党','看重强度和规划<br>培养版本最强配队<br>低线城市+移动端占比高<br>ARPG经验丰富','yellow',T('次日流失突出','r')),
    '</div>',
    '<div class="insight ar4" style="margin-top:8px;">因子分析提纯核心维度 → K-Means聚类 → 5类群体。每类核心特征显著高于其他群体。</div>'
  ])
);

// 5 — Day1 churn: BAR CHARTS
S('Q2 · 次日流失原因',10,
  '次日流失的核心原因很清晰——玩法和美术没打动人。战斗无聊和美术风格不满是差评的集中区。但值得注意，次日流失玩家的上手难度评分反而是三组最高的——说明不是玩不懂，是不想玩。这属于产品品质未达预期的自然流失。',
  H([
    '<h2>次日流失：差评点 & 好评率对比</h2>',
    '<div class="grid-2">',
      '<div class="card ar" style="padding:20px;"><div style="font-weight:700;margin-bottom:10px;color:var(--yellow);">' + T('差评高于留存','y') + '</div>',
        BR('战斗无聊','75','#f59e0b','> 留存 2x'),
        BR('不喜欢美术风格','65','#f59e0b','> 留存'),
        BR('缺少横版动作动力','60','#f59e0b','动力不足'),
        BR('美术好评率','35','#f59e0b','< 留存'),
        BR('玩法好评率','30','#f59e0b','< 留存'),
      '</div>',
      '<div class="card ar1" style="padding:20px;"><div style="font-weight:700;margin-bottom:10px;color:var(--green);">' + T('非流失原因（排除）','g') + '</div>',
        BR('上手难度评分','80','#10b981','三组最高'),
        BR('战斗操作吐槽率','15','#10b981','三组最低'),
        BR('机制理解困难','20','#10b981','不突出'),
        BR('卡顿感知','40','#f59e0b','低于三日流'),
      '</div>',
    '</div>',
    '<div class="insight ar2" style="margin-top:8px;"><strong style="color:var(--yellow);">定性：</strong>产品品质未达预期的自然流失——首日玩法展示和美术呈现没给"继续玩"的理由。</div>'
  ])
);

// 6 — Day3 churn: BAR CHARTS
S('Q2 · 三日流失原因',10,
  '三日流失不一样。这群人对战斗的期待是最高的——一半人以战斗爽感为核心动力。但卡顿感知在三组中最突出，流畅度、设备适配、引导教学好评率全部低于其他玩家。战斗乐趣好评率也偏低。高期待被低体验消耗了。',
  H([
    '<h2>三日流失：差评点 & 好评率对比</h2>',
    '<div class="grid-2">',
      '<div class="card ar" style="padding:20px;"><div style="font-weight:700;margin-bottom:10px;color:var(--red);">' + T('差评高于留存','r') + '</div>',
        BR('卡顿问题','85','#f43f5e','三组最突出'),
        BR('流畅度不足','70','#f43f5e','< 留存'),
        BR('战斗乐趣好评低','65','#f43f5e','< 留存'),
        BR('设备适配差','55','#f43f5e','< 留存'),
        BR('引导教学不足','50','#f43f5e','< 留存'),
      '</div>',
      '<div class="card ar1" style="padding:20px;"><div style="font-weight:700;margin-bottom:10px;color:var(--accent);">' + T('关键特征','a') + '</div>',
        BR('战斗爽感为核心动力','90','#6366f1','三组最高 ~50%'),
        BR('战斗/操作困难吐槽','72','#f43f5e','三组最高'),
        BR('躲避怪物攻击吐槽','68','#f43f5e','> 次流+留存'),
        BR('跳跃冲刺陷阱吐槽','60','#f43f5e','> 次流+留存'),
      '</div>',
    '</div>',
    '<div class="insight ar2" style="margin-top:8px;"><strong style="color:var(--red);">定性：</strong>高期待玩家被基础体验消耗。不是游戏方向有问题，是体验质量没跟上。</div>'
  ])
);

// 7 — 30% SIGNAL (from colleague)
S('⚠️ 关键信号 · 好评陷阱',8,
  '一个必须单独拉出来说的数据。流失玩家中，有近三成在首日问卷中表示"体验较好，有很大动力继续游玩"。但他们最终还是流失了。首日体验的刺激性不足以为长期留存提供燃料。',
  H([
    '<div class="hl-box as" style="max-width:750px;text-align:center;">',
      '<p style="font-size:1.2em;margin-bottom:10px;">流失玩家中，有 <strong style="color:var(--red);font-size:1.4em;">近三成</strong></p>',
      '<p style="font-size:1em;margin-bottom:10px;">在首日问卷中表示「<strong style="color:#fff;">体验较好，有很大动力继续游玩</strong>」</p>',
      '<p style="font-size:.88em;color:var(--red);">——但他们最终还是流失了。</p>',
      '<div class="divider"></div>',
      '<p style="font-size:.82em;color:var(--text2);">→ 首日体验的刺激性，不足以转化为实际留存。<br>→ 需要更强的首日核心爽点展示 + 次日内容衔接设计。</p>',
    '</div>'
  ])
);

// 8 — Causal chain
S('因果链 · 谁流失→为什么→怎么改',10,
  '串成完整链路。次日流失卡在首日印象关——玩法和美术不吸引。三日流失卡在深度体验关——战斗和流畅度消耗耐心。两关都过才是留存。对应的优化方向：基础体验缓解卡顿提升流畅度，战斗体验优化闪避和怪物提示，教学拆分战斗机制和养成指引。',
  H([
    '<h2>流失因果链</h2>',
    '<div class="flow-row as" style="margin-bottom:12px;">',
      '<div style="text-align:center;min-width:150px;" class="ar"><div style="font-size:.76em;color:var(--muted);margin-bottom:6px;">谁在流失</div>',
        '<div class="flow-box" style="border-top:3px solid var(--yellow);margin-bottom:4px;"><strong>次日流失</strong>女性/一二线<br>强度党/移动端</div>',
        '<div class="flow-box" style="border-top:3px solid var(--red);"><strong>三日流失</strong>操作高玩党<br>移动端/高期待</div>',
      '</div>',
      '<span class="flow-arrow ar1">→</span>',
      '<div style="text-align:center;min-width:150px;" class="ar1"><div style="font-size:.76em;color:var(--muted);margin-bottom:6px;">卡在哪关</div>',
        '<div class="flow-box" style="border-top:3px solid var(--yellow);margin-bottom:4px;"><strong>首日印象关</strong>玩法不吸引<br>美术不喜欢</div>',
        '<div class="flow-box" style="border-top:3px solid var(--red);"><strong>深度体验关</strong>战斗期待落差<br>卡顿+流畅度</div>',
      '</div>',
      '<span class="flow-arrow ar2">→</span>',
      '<div style="text-align:center;min-width:170px;" class="ar2"><div style="font-size:.76em;color:var(--muted);margin-bottom:6px;">怎么优化</div>',
        '<div class="flow-box" style="border-top:3px solid var(--green);margin-bottom:4px;"><strong>基础体验</strong>缓解卡顿<br>提升流畅度+画质</div>',
        '<div class="flow-box" style="border-top:3px solid var(--green);margin-bottom:4px;"><strong>战斗体验</strong>优化闪避<br>加强怪物抬手提示</div>',
        '<div class="flow-box" style="border-top:3px solid var(--green);"><strong>教学拆分</strong>拆分战斗机制<br>和养成指引</div>',
      '</div>',
    '</div>',
    '<div class="insight ar3">次日流失和三日流失是两种完全不同的流失逻辑，需要分层施策——不能一刀切。</div>'
  ])
);

// 9 — Comparison matrix
S('对比 · 三组全维度',13,
  '全量对比速查表。留存、次日流失、三日流失在九个维度上的差异一目了然。',
  H([
    '<h2>三组全维度对比矩阵</h2>',
    '<div class="table-wrap as"><table>',
      '<thead><tr><th style="width:80px;">维度</th><th style="width:155px;">'+T('次日流失','y')+'</th><th style="width:155px;">'+T('三日流失','r')+'</th><th style="width:155px;">'+T('留存玩家','g')+'</th></tr></thead><tbody>',
      '<tr class="ar"><td><strong>性别</strong></td><td style="color:var(--yellow);">女性占比突出</td><td>—</td><td style="color:var(--green);">男性占比较高</td></tr>',
      '<tr class="ar1"><td><strong>年龄</strong></td><td>—</td><td style="color:var(--red);">36岁以上突出</td><td style="color:var(--green);">18-25岁占比高</td></tr>',
      '<tr class="ar2"><td><strong>城市</strong></td><td style="color:var(--yellow);">一二线偏高</td><td>—</td><td style="color:var(--green);">低线城市留存好</td></tr>',
      '<tr class="ar3"><td><strong>设备</strong></td><td style="color:var(--yellow);">移动端为主</td><td style="color:var(--red);">移动端为主</td><td style="color:var(--green);">PC+双端占比高</td></tr>',
      '<tr class="ar4"><td><strong>游戏经验</strong></td><td style="color:var(--yellow);">二游经验少</td><td style="color:var(--red);">战斗期待高</td><td style="color:var(--green);">银恶经验比例高</td></tr>',
      '<tr><td><strong>长期诉求</strong></td><td style="color:var(--yellow);">强度党突出</td><td style="color:var(--red);">操作高玩党偏多</td><td style="color:var(--green);">剧情探索党为主</td></tr>',
      '<tr><td><strong>好评点</strong></td><td style="color:var(--yellow);">美术+玩法低于留存</td><td style="color:var(--red);">战斗乐趣+基础体验低</td><td style="color:var(--green);">美术和玩法Top2</td></tr>',
      '<tr><td><strong>差评点</strong></td><td style="color:var(--yellow);">战斗无聊+美术不满</td><td style="color:var(--red);">卡顿最突出</td><td style="color:var(--green);">按键和卡顿Top2</td></tr>',
      '<tr><td><strong>上手难度</strong></td><td>评分反而最高</td><td style="color:var(--red);">战斗操作困难突出</td><td style="color:var(--green);">机制理解类困难</td></tr>',
      '</tbody></table></div>'
  ])
);

// 10 — Optimization: ACTION CARDS (from colleague)
S('优化 · 行动建议',9,
  '三个优化方向，按优先级排列。P0：基础体验——卡顿和流畅度是贯穿两组流失玩家的共同痛点。P1：战斗体验和教学拆分——直接影响三日流失的核心问题。P2：定向群体策略——为强度党和操作高玩党定制首日内容。',
  H([
    '<h2>重点优化方向</h2>',
    '<div class="action-grid as">',
      '<div class="action-card p0 ar"><span class="prio p0">P0</span><h4>基础体验优化</h4><p>缓解卡顿问题，提升流畅度<br>提升关键场景画质表现<br>改善设备适配兼容性</p></div>',
      '<div class="action-card p0 ar1"><span class="prio p0">P0</span><h4>战斗体验优化</h4><p>加强怪物抬手动作提示<br>优化闪避体验与操作反馈<br>让玩家更早体验到战斗爽感</p></div>',
      '<div class="action-card p1 ar2"><span class="prio p1">P1</span><h4>教学与引导优化</h4><p>拆分战斗机制和养成内容指引<br>降低操作类上手门槛<br>优化功能入口引导体验</p></div>',
      '<div class="action-card p1 ar3"><span class="prio p1">P1</span><h4>定向群体策略</h4><p>强度党：首日展示更多养成深度<br>高玩党：D2-D3提供高难度内容<br>次日流失：强化首日核心爽点刺激</p></div>',
    '</div>'
  ])
);

// 11 — Summary
S('总结',6,
  '总结三条。第一，次日流失和三日流失是两种完全不同的逻辑，分层施策。第二，五类玩家留存风险不同，强度党和操作党重点观察。第三，基础体验的卡顿和流畅度是共同痛点，优化优先级排在新内容前面。以上。',
  H([
    '<div class="card ca as" style="text-align:center;padding:34px;">',
      '<div style="font-size:.72em;color:var(--accent);letter-spacing:.1em;margin-bottom:10px;font-weight:600;">CONCLUSION</div>',
      '<h2 style="border:none;padding:0;font-size:1.5em;background:none;-webkit-text-fill-color:var(--accent);">分层施策，精准挽留</h2>',
      '<div class="divider"></div>',
      '<div class="grid-3" style="margin-top:8px;">',
        '<div class="ar" style="text-align:center;padding:12px;"><div style="font-size:1.5em;font-weight:800;color:var(--accent);">1</div><div style="font-size:.82em;">次日 ≠ 三日<br><span style="color:var(--text2);">两种逻辑，分层应对</span></div></div>',
        '<div class="ar1" style="text-align:center;padding:12px;"><div style="font-size:1.5em;font-weight:800;color:var(--purple);">2</div><div style="font-size:.82em;">5类玩家风险不同<br><span style="color:var(--text2);">强度党+操作党重点观察</span></div></div>',
        '<div class="ar2" style="text-align:center;padding:12px;"><div style="font-size:1.5em;font-weight:800;color:var(--green);">3</div><div style="font-size:.82em;">基础体验优先<br><span style="color:var(--text2);">卡顿流畅度 > 新内容</span></div></div>',
      '</div>',
    '</div>'
  ])
);

// ======================== ENGINE ========================
var ci=0,playing=false,sT=null,elapsed=0,tI=null;
var $S=$('stage'),$NB=$('narrationBar'),$NT=$('narrationText'),$CT=$('chapterTag'),$PF=$('progressFill'),$TD=$('timeDisplay'),$TL=$('timelineDots'),$BP=$('btnPlay'),$BL=$('btnPrev'),$BR=$('btnNext');
D.forEach(function(s,i){
  var d=document.createElement('span');d.className='tl-dot';d.title='S'+(i+1)+': '+s.chapter;
  d.onclick=(function(x){return function(){go(x);};})(i);$TL.appendChild(d);
  var e=document.createElement('div');e.className='scene';e.id='s-'+i;$S.appendChild(e);
});
function render(i){$('s-'+i).innerHTML='<div class="cm">'+D[i].chapter+'</div>'+D[i].html;}
function show(i){
  var all=document.querySelectorAll('.scene');for(var j=0;j<all.length;j++)all[j].classList.remove('on');
  render(i);requestAnimationFrame(function(){$('s-'+i).classList.add('on');});
  $NT.textContent=D[i].narration;$NB.classList.add('on');$CT.textContent=D[i].chapter;
  var dots=document.querySelectorAll('.tl-dot');
  for(var j=0;j<dots.length;j++){dots[j].className='tl-dot';if(j<i)dots[j].classList.add('done');if(j===i)dots[j].classList.add('cur');}
  $PF.style.width=((i+1)/D.length*100)+'%';
}
function go(i){if(i<0||i>=D.length)return;stop();ci=i;elapsed=0;show(i);upT();upB();}
function upT(){var m=Math.floor(elapsed/60),s=elapsed%60;$TD.textContent=(m<10?'0'+m:m)+':'+(s<10?'0'+s:s);}
function upB(){$BL.disabled=(ci===0);$BR.disabled=(ci===D.length-1);}
function stop(){playing=false;clearTimeout(sT);clearInterval(tI);$BP.textContent='Play';}
function start(){
  if(ci>=D.length-1){ci=0;show(0);}playing=true;$BP.textContent='Pause';sched();
  tI=setInterval(function(){elapsed++;upT();if(elapsed>D[ci].duration+2){if(ci<D.length-1){go(ci+1);if(playing)sched();}else stop();}},1000);
}
function sched(){clearTimeout(sT);sT=setTimeout(function(){if(!playing)return;if(ci<D.length-1){go(ci+1);sched();}else stop();},D[ci].duration*1000);}
var ctrl={toggle:function(){playing?stop():start();},next:function(){stop();go(ci+1);},prev:function(){stop();go(ci-1);}};
$BP.onclick=ctrl.toggle;$BL.onclick=ctrl.prev;$BR.onclick=ctrl.next;
document.addEventListener('keydown',function(e){
  if(e.key===' '||e.key==='Spacebar'){e.preventDefault();ctrl.toggle();}
  if(e.key==='ArrowRight'||e.key==='ArrowDown'){e.preventDefault();ctrl.next();}
  if(e.key==='ArrowLeft'||e.key==='ArrowUp'){e.preventDefault();ctrl.prev();}
  if(e.key==='Escape')stop();
});
$BP.textContent='Play';$BL.textContent='<';$BR.textContent='>';
go(0);upB();
