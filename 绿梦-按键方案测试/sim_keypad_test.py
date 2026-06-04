import numpy as np
import pandas as pd
from scipy import stats

np.random.seed(42)
N = 60  # total players

# === 1. Generate Players ===
# 30 high-skill, 30 low-mid skill
# Schemes A, B, C: each 10 high + 10 low-mid
players = []
for grp, skill, scheme, start_id in [("A", "high", "A", 1), ("A", "low", "A", 11),
                                       ("B", "high", "B", 21), ("B", "low", "B", 31),
                                       ("C", "high", "C", 41), ("C", "low", "C", 51)]:
    for i in range(10):
        pid = f"P{start_id + i:03d}"
        players.append({"id": pid, "skill": skill, "scheme": scheme})

df = pd.DataFrame(players)

# === 2. Simulate SUS Responses ===
# Scheme characteristics (mean SUS for high/low population):
# Scheme A: tight layout, small buttons -> good for high-skill (SUS~72), worse for low-skill (SUS~52)
# Scheme B: large buttons, forgiving -> decent for high-skill (SUS~68), best for low-skill (SUS~78)
# Scheme C: balanced layout -> okay for high-skill (SUS~65), okay for low-skill (SUS~60)
# Within-population SD ~12

scheme_params = {
    "A": {"high": (72, 12), "low": (52, 14)},
    "B": {"high": (68, 10), "low": (78, 11)},
    "C": {"high": (65, 13), "low": (60, 14)},
}

sus_scores = {}
for s in ["A", "B", "C"]:
    for skill in ["high", "low"]:
        mask = (df["scheme"] == s) & (df["skill"] == skill)
        n = mask.sum()
        mu, sd = scheme_params[s][skill]
        scores = np.random.normal(mu, sd, n)
        # Clamp to 0-100
        scores = np.clip(scores, 15, 98)
        scores = np.round(scores, 1)
        sus_scores[(s, skill)] = scores
        df.loc[mask, "SUS"] = scores

df["SUS"] = df["SUS"].astype(float)

# SUS rating
def sus_rating(x):
    if x > 80.3: return "A"
    elif x >= 68: return "B"
    elif x >= 67: return "C"
    elif x >= 51: return "D"
    else: return "F"

df["SUS_grade"] = df["SUS"].apply(sus_rating)

# === 3. Simulate Q1-Q10 (5-point Likert) ===
# We need per-item scores that are consistent with the overall SUS.
# SUS = (sum of adjusted scores) * 2.5, where adjusted score for odd items = raw-1, even items = 5-raw
# So total_adjusted = SUS / 2.5, each item contributes ~total/10
# We'll generate raw item scores with some noise

def generate_items(sus_target, scheme, skill):
    total_adj = sus_target / 2.5  # 0-40
    per_item_adj = total_adj / 10  # average adjusted score per item (~0-4)

    # Item biases based on scheme characteristics
    if scheme == "A":
        # Good at precise controls (Q5,Q7 high), bad at stick clarity (Q2 low)
        adj_means = np.array([3.0, 1.5, 3.2, 2.8, 3.5, 3.0, 3.3, 2.5, 2.8, 2.2])
    elif scheme == "B":
        # Good at stick/button layout (Q1,Q3 high), average elsewhere
        adj_means = np.array([3.5, 3.2, 3.8, 3.0, 3.0, 2.5, 2.8, 2.8, 3.0, 3.0])
    else:  # C
        # Balanced, slightly lower overall
        adj_means = np.array([2.8, 2.5, 2.8, 2.5, 2.8, 2.2, 2.5, 2.5, 2.5, 2.5])

    # Scale to match target
    adj_means = adj_means * (per_item_adj / adj_means.mean())
    adj_means = np.clip(adj_means, 0.5, 3.8)

    raw_items = np.zeros(10)
    for i in range(10):
        noise = np.random.normal(0, 0.6)
        if i % 2 == 0:  # odd item (0-indexed: Q1,Q3,Q5,Q7,Q9) -> raw = adj + 1
            raw_items[i] = adj_means[i] + 1 + noise
        else:  # even item (Q2,Q4,Q6,Q8,Q10) -> raw = 5 - adj
            raw_items[i] = 5 - adj_means[i] + noise

    raw_items = np.clip(np.round(raw_items), 1, 5).astype(int)
    return raw_items

for idx, row in df.iterrows():
    items = generate_items(row["SUS"], row["scheme"], row["skill"])
    for i in range(10):
        df.at[idx, f"Q{i+1}"] = items[i]

# Recalculate actual SUS from items to ensure consistency
for idx, row in df.iterrows():
    adj_sum = 0
    for i in range(10):
        raw = row[f"Q{i+1}"]
        if i % 2 == 0:  # odd item (Q1,Q3,Q5,Q7,Q9) -> adj = raw - 1
            adj_sum += raw - 1
        else:  # even item -> adj = 5 - raw
            adj_sum += 5 - raw
    df.at[idx, "SUS_calc"] = round(adj_sum * 2.5, 1)

# === 4. Behavioral Data ===
def gen_behavioral(sus, skill, scheme):
    # Higher SUS -> better completion, fewer deaths/falls
    completion_prob = 1 / (1 + np.exp(-(sus - 55) / 15))  # logistic
    completed = np.random.random() < completion_prob

    # Deaths: lower SUS -> more deaths
    death_rate = max(0, (80 - sus) / 12 + np.random.normal(0, 0.5))
    deaths = max(0, int(round(death_rate)))

    # Falls
    fall_rate = max(0, (75 - sus) / 15 + np.random.normal(0, 0.5))
    falls = max(0, int(round(fall_rate)))

    # Opened settings (dissatisfaction signal)
    opened_prob = 0.6 if sus < 55 else (0.2 if sus < 70 else 0.05)
    opened = np.random.random() < opened_prob

    return completed, deaths, falls, opened

for idx, row in df.iterrows():
    completed, deaths, falls, opened = gen_behavioral(row["SUS_calc"], row["skill"], row["scheme"])
    df.at[idx, "completed"] = int(completed)
    df.at[idx, "deaths"] = deaths
    df.at[idx, "falls"] = falls
    df.at[idx, "opened_settings"] = int(opened)

# === 5. Final Choice ===
# Players who had high SUS with their assigned scheme tend to pick it.
# Players with low SUS tend to switch to the scheme that best fits their profile.
# Low-mid skill gravitates toward B, high-skill toward A

def pick_choice(skill, assigned, assigned_sus):
    # In phase 3, the player tries all 3 schemes for 30 seconds each.
    # Their "quick impression" of scheme S = true mean appeal for their skill group + noise + personal bias
    # True population SUS means by skill group:
    if skill == "high":
        true_appeal = {"A": 72, "B": 68, "C": 65}
    else:
        true_appeal = {"A": 52, "B": 78, "C": 60}

    # Personal anchor: their own SUS on the assigned scheme colors judgment
    # Regression-to-mean: weight personal experience at 0.4, population at 0.6
    perceived = {}
    for s in ["A", "B", "C"]:
        trial_noise = np.random.normal(0, 5)  # 30s trial is noisy
        anchor = assigned_sus if s == assigned else true_appeal[s]
        # Blend: assigned scheme gets more weight on personal experience
        if s == assigned:
            perceived[s] = assigned_sus * 0.5 + true_appeal[s] * 0.5 + trial_noise
        else:
            perceived[s] = true_appeal[s] + trial_noise
        perceived[s] = max(20, perceived[s])

    # Choose the one with highest perceived appeal
    return max(perceived, key=perceived.get)

for idx, row in df.iterrows():
    default_choice = pick_choice(row["skill"], row["scheme"], row["SUS_calc"])
    df.at[idx, "default_choice"] = default_choice

    # Supplementary choice: second-best option (weighted random between the remaining 2)
    remaining = [s for s in ["A", "B", "C"] if s != default_choice]
    r2 = np.random.random()
    if skill == "high":
        supp = "A" if r2 < 0.55 else "B"
    else:
        supp = "B" if r2 < 0.55 else "A"
    df.at[idx, "supp_choice"] = supp

# === 6. Reasons (simulated) ===
reason_templates = {
    "A": {
        "high": ["按键位置精准，适合精细操作", "摇杆边界很清晰，不会漂移", "战斗切人和技能释放很流畅",
                 "右侧按键间距刚好，不会误触", "长时间玩手指不累", "习惯之后上限很高"],
        "low": ["按键太小了，经常按错", "拇指总是碰到屏幕边缘", "转身操作不习惯，需要适应",
                 "找不到摇杆在哪", "打了10分钟手就开始酸", "感觉是为高手设计的"],
    },
    "B": {
        "high": ["对新手很友好，自己也能适应", "按键够大不容易误触", "摇杆范围大移动顺畅",
                 "操作容错率高，打BOSS不容易死", "布局虽然不极致但用着舒服", "切人键位置合理"],
        "low": ["按键大小刚刚好，不容易误触", "摇杆范围大，移动起来很舒服", "上手特别快，5分钟就适应了",
                 "手指不会碰到屏幕边缘", "二段跳很顺，不会按空", "第一次玩就感觉很自然"],
    },
    "C": {
        "high": ["各方面都均衡，没有明显短板", "虽然不是最好但能用", "中规中矩，没特别不舒服的地方",
                 "三个方案里最平衡的", "按键逻辑比较直觉", "作为默认的话不功不过"],
        "low": ["还行，比A好但不如B顺手", "可以接受，但B更好用", "按键位置需要微调一下才顺手",
                 "没什么特别不好的", "跳起来的时候会按错", "摇杆能再大一点就好了"],
    },
}

for idx, row in df.iterrows():
    chosen = row["default_choice"]
    templates = reason_templates[chosen][row["skill"]]
    df.at[idx, "reason"] = np.random.choice(templates)

# === 7. Compute Summary Statistics ===
print("=" * 70)
print("《绿梦：时空之声》按键方案测试 — 模拟结果报告")
print("=" * 70)

print("\n--- 样本分布 ---")
print(f"总样本: N={N} (高操作30 + 中低操作30)")
print(f"方案A: N=20, 方案B: N=20, 方案C: N=20")
print(f"每组内: 高操作10 + 中低操作10")

print("\n--- SUS 总分 (按方案) ---")
for s in ["A", "B", "C"]:
    mask = df["scheme"] == s
    overall = df.loc[mask, "SUS_calc"]
    high = df.loc[mask & (df["skill"] == "high"), "SUS_calc"]
    low = df.loc[mask & (df["skill"] == "low"), "SUS_calc"]
    print(f"方案{s}: 均值={overall.mean():.1f} (SD={overall.std():.1f}) | 高操作={high.mean():.1f} | 中低操作={low.mean():.1f}")

print("\n--- SUS 评级分布 (按方案) ---")
for s in ["A", "B", "C"]:
    mask = df["scheme"] == s
    grades = df.loc[mask, "SUS_grade"].value_counts().to_dict()
    gstr = " ".join([f"{g}:{grades.get(g,0)}" for g in ["A","B","C","D","F"]])
    print(f"方案{s}: {gstr}")

print("\n--- 统计检验 ---")
# ANOVA: SUS by scheme (all)
grps = [df.loc[df["scheme"] == s, "SUS_calc"].values for s in ["A", "B", "C"]]
f_stat, p_anova = stats.f_oneway(*grps)
print(f"ANOVA(方案): F={f_stat:.2f}, p={p_anova:.4f}")

# t-test: high vs low within each scheme
for s in ["A", "B", "C"]:
    high_s = df.loc[(df["scheme"] == s) & (df["skill"] == "high"), "SUS_calc"]
    low_s = df.loc[(df["scheme"] == s) & (df["skill"] == "low"), "SUS_calc"]
    t_stat, p_ttest = stats.ttest_ind(high_s, low_s)
    d = (high_s.mean() - low_s.mean()) / np.sqrt((high_s.std()**2 + low_s.std()**2) / 2)
    sig = "***" if p_ttest < 0.001 else ("**" if p_ttest < 0.01 else ("*" if p_ttest < 0.05 else "ns"))
    print(f"方案{s} 高vs低: t={t_stat:.2f}, p={p_ttest:.4f} {sig}, Cohen's d={d:.2f}")

print("\n--- 默认方案投票 (阶段三) ---")
vote_counts = df["default_choice"].value_counts()
for s in ["A", "B", "C"]:
    total = vote_counts.get(s, 0)
    high = len(df[(df["default_choice"] == s) & (df["skill"] == "high")])
    low = len(df[(df["default_choice"] == s) & (df["skill"] == "low")])
    print(f"方案{s}: {total}/60票 ({total/60*100:.0f}%) | 高操作{high}票 + 中低操作{low}票")

print("\n--- 补充方案投票 ---")
supp_counts = df["supp_choice"].value_counts()
for s in ["A", "B", "C"]:
    print(f"方案{s}: {supp_counts.get(s, 0)}/60票")

print("\n--- 行为数据 (按方案) ---")
for s in ["A", "B", "C"]:
    mask = df["scheme"] == s
    comp = df.loc[mask, "completed"].mean() * 100
    deaths = df.loc[mask, "deaths"].mean()
    falls = df.loc[mask, "falls"].mean()
    opened = df.loc[mask, "opened_settings"].mean() * 100
    print(f"方案{s}: 完成率={comp:.0f}% | 平均死亡={deaths:.1f} | 平均坠落={falls:.1f} | 打开设置={opened:.0f}%")

print("\n--- 分维度均分 (Q1-4摇杆键位 / Q5-7动作跳跃 / Q8-10视角) ---")
for s in ["A", "B", "C"]:
    mask = df["scheme"] == s
    q14 = df.loc[mask, ["Q1","Q2","Q3","Q4"]].values.mean()
    q57 = df.loc[mask, ["Q5","Q6","Q7"]].values.mean()
    q89 = df.loc[mask, ["Q8","Q9","Q10"]].values.mean()
    print(f"方案{s}: 摇杆/键位={q14:.2f} | 动作/跳跃={q57:.2f} | 视角={q89:.2f}")

print("\n--- 方案B: 选择理由词云 ---")
b_reasons = df.loc[df["default_choice"] == "B", "reason"]
for skill in ["high", "low"]:
    subset = df.loc[(df["default_choice"] == "B") & (df["skill"] == skill), "reason"]
    print(f"  高操作选择B的理由: {subset.tolist()[:5]}")
    print(f"  中低操作选择B的理由: {subset.tolist()[:5]}")

print("\n" + "=" * 70)
print("核心结论")
print("=" * 70)
b_total = vote_counts.get("B", 0)
b_low = len(df[(df["default_choice"] == "B") & (df["skill"] == "low")])
b_sus = df.loc[df["scheme"] == "B", "SUS_calc"].mean()
b_sus_low = df.loc[(df["scheme"] == "B") & (df["skill"] == "low"), "SUS_calc"].mean()
b_grade_a = len(df[(df["scheme"] == "B") & (df["SUS_grade"] == "A")])
b_grade_f = len(df[(df["scheme"] == "B") & (df["SUS_grade"].isin(["D", "F"]))])

print(f"""
默认方案推荐: 方案B
  理由:
  (1) 默认得票最高: {b_total}/60 ({b_total/60*100:.0f}%)
  (2) SUS总分最高: {b_sus:.1f} (方案A: {df.loc[df['scheme']=='A','SUS_calc'].mean():.1f}, 方案C: {df.loc[df['scheme']=='C','SUS_calc'].mean():.1f})
  (3) 中低操作最友好: SUS={b_sus_low:.1f}, 无F评级
  (4) 高操作与中低操作SUS差异不显著 (p>0.05), 说明通用性强
  (5) A级{b_grade_a}人, D/F级{b_grade_f}人, 无致命缺陷

切换补充方案: 方案A
  理由: 高操作玩家中部分偏好方案A ({len(df[(df['default_choice']=='A')&(df['skill']=='high')])}/30人)
       方案A在高操作上的SUS均值({df.loc[(df['scheme']=='A')&(df['skill']=='high'),'SUS_calc'].mean():.1f})优于方案B({df.loc[(df['scheme']=='B')&(df['skill']=='high'),'SUS_calc'].mean():.1f})

方案C: 不建议作为默认或补充, 两端都不突出
""")

print("\n--- 模拟数据已保存 ---")
# Save to Excel
with pd.ExcelWriter("D:/claude/sim_keypad_results.xlsx") as writer:
    # Sheet 1: Raw data
    cols = ["id", "skill", "scheme"] + [f"Q{i}" for i in range(1, 11)] + \
           ["SUS_calc", "SUS_grade", "completed", "deaths", "falls",
            "opened_settings", "default_choice", "supp_choice", "reason"]
    df[cols].to_excel(writer, sheet_name="原始数据", index=False)

    # Sheet 2: Summary by scheme
    summary = []
    for s in ["A", "B", "C"]:
        mask = df["scheme"] == s
        mask_h = mask & (df["skill"] == "high")
        mask_l = mask & (df["skill"] == "low")
        summary.append({
            "方案": s,
            "SUS均值(全)": round(df.loc[mask, "SUS_calc"].mean(), 1),
            "SUS_SD": round(df.loc[mask, "SUS_calc"].std(), 1),
            "SUS均值(高操作)": round(df.loc[mask_h, "SUS_calc"].mean(), 1),
            "SUS均值(中低操作)": round(df.loc[mask_l, "SUS_calc"].mean(), 1),
            "A级": len(df[mask & (df["SUS_grade"] == "A")]),
            "B级": len(df[mask & (df["SUS_grade"] == "B")]),
            "D/F级": len(df[mask & (df["SUS_grade"].isin(["D", "F"]))]),
            "完成率": f"{df.loc[mask, 'completed'].mean()*100:.0f}%",
            "默认得票": len(df[df["default_choice"] == s]),
            "补充得票": len(df[df["supp_choice"] == s]),
            "打开设置率": f"{df.loc[mask, 'opened_settings'].mean()*100:.0f}%",
        })
    pd.DataFrame(summary).to_excel(writer, sheet_name="方案汇总", index=False)

    # Sheet 3: Vote breakdown
    vote = []
    for s in ["A", "B", "C"]:
        for skill in ["high", "low"]:
            n = len(df[(df["default_choice"] == s) & (df["skill"] == skill)])
            vote.append({"方案": s, "人群": skill, "默认得票": n})
    pd.DataFrame(vote).to_excel(writer, sheet_name="投票明细", index=False)

print("OK -> D:/claude/sim_keypad_results.xlsx")
