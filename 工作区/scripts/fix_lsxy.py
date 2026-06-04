# Fix gen_lsxy.py encoding issue
with open('D:/claude/gen_lsxy.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the entire problematic Q call
old = '''Q("H1",
  "您最看重开放世界游戏的哪些方面？\\n（结合UP主建议：顺着游戏特色突出填写——蓝色星原有幻想世界+家园系统+卡牌对战）",
  "多选题/排序题（推断）",
  "宏大的幻想世界观\\n丰富的角色收集与养成\\n自由探索的大世界\\n家园建造与经营系统\\n卡牌对战体系\\n精美的二次元画风\\n爽快的战斗手感\\n其他",
  "推断（视频中UP主提示）",
  "V1:f00900-f01260 展示了游戏特色：幻想大世界RPG + 家园系统 + 卡牌对战。UP主建议"顺着游戏特色突出重点更容易通过初筛"")'''

new = '''Q("H1",
  "您最看重开放世界游戏的哪些方面？(结合UP主建议：顺着游戏特色突出填写)",
  "多选题/排序题（推断）",
  "宏大的幻想世界观\\n丰富的角色收集与养成\\n自由探索的大世界\\n家园建造与经营系统\\n卡牌对战体系\\n精美的二次元画风\\n爽快的战斗手感\\n其他",
  "推断（视频中UP主提示）",
  "V1:f00900-f01260 展示了游戏特色，UP主建议顺着游戏特色突出重点更容易通过初筛")'''

if old in content:
    content = content.replace(old, new)
    with open('D:/claude/gen_lsxy.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed!")
else:
    print("NOT FOUND - trying alternative...")
    # Find the line containing H1
    for i, line in enumerate(content.split('\n')):
        if 'H1' in line and 'Q(' in line:
            print(f"Line {i+1}: {line[:80]}...")
