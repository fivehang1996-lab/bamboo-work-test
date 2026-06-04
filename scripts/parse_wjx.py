import re, json, sys
from html import unescape
from urllib.parse import unquote

def parse_wjx(html_path):
    with open(html_path, "r", encoding="utf-8") as f:
        html = f.read()

    # Extract title
    title_m = re.search(r'originalSurveyTitle\s*=\s*"(.+?)"', html)
    title = unquote(title_m.group(1)) if title_m else "未知标题"

    # Extract divQuestion content
    m = re.search(r'<div id="divQuestion"\s*>(.+?)</div>\s*<div id="divMatrixRel"', html, re.DOTALL)
    if not m:
        print("ERROR: divQuestion not found")
        return None
    content = m.group(1)

    # Parse fieldsets (pages)
    fieldsets = re.findall(r'<fieldset[^>]*pg=[\'"](\d+)[\'"][^>]*>(.+?)</fieldset>', content, re.DOTALL)

    questions = []
    qid = 0
    current_pg = 0

    for pg, fs_html in fieldsets:
        current_pg = int(pg)
        # Find all question divs
        qdivs = re.findall(
            r"<div class='field ui-field-contain'\s+topic='(\d+)'[^>]*?(?:type='(\d+)')?[^>]*>(.+?)<div class='errorMessage'>",
            fs_html, re.DOTALL
        )
        for topic, qtype, qhtml in qdivs:
            qid += 1
            # Extract question text
            qt_m = re.search(r"<div class='topichtml'>(.+?)</div>", qhtml, re.DOTALL)
            qt = unescape(qt_m.group(1)).strip() if qt_m else ""

            # Clean HTML tags
            qt = re.sub(r'<[^>]+>', '', qt)
            qt = re.sub(r'\s+', ' ', qt).strip()

            # Extract req
            req = '1' if "req='1'" in qhtml else '0'

            # Extract max/min values
            maxv = re.search(r"maxvalue='(\d+)'", qhtml)
            maxv = maxv.group(1) if maxv else None
            minv = re.search(r"minvalue='(\d+)'", qhtml)
            minv = minv.group(1) if minv else None

            # Extract options from labels (dit=URL-encoded text)
            options = []
            labels = re.findall(r"dit='([^']+)'[^>]*>([^<]*)</div>", qhtml)
            for dit, fallback in labels:
                opt_text = unquote(dit) if dit else fallback.strip()
                opt_text = re.sub(r'<[^>]+>', '', opt_text)
                options.append(opt_text)

            # Also try li-static items (for ranking/sort questions)
            if not options:
                lis = re.findall(r"<li[^>]*>.*?<span>([^<]+)</span>", qhtml, re.DOTALL)
                options = [re.sub(r'\s+', ' ', unescape(s)).strip() for s in lis]

            # Extract relation/condition
            relation = re.search(r"relation='([^']+)'", qhtml)
            relation = relation.group(1) if relation else None

            # Type mapping
            type_map = {'1': '填空', '2': '文本填空', '3': '单选题', '4': '多选题', '5': '量表题', '6': '矩阵题', '11': '排序题'}
            qtype_str = type_map.get(qtype, f'类型{qtype}')

            # Build note
            notes = []
            if req == '1':
                notes.append("必答")
            if maxv:
                notes.append(f"最多{maxv}项")
            if minv:
                notes.append(f"至少{minv}项")
            if relation:
                notes.append(f"条件显示: {relation}")

            questions.append({
                "id": qid,
                "topic": topic,
                "pg": current_pg,
                "q": qt,
                "type": qtype_str,
                "options": options,
                "note": "，".join(notes),
                "relation": relation,
                "maxv": maxv,
                "minv": minv,
                "req": req,
            })

    return {"title": title, "questions": questions, "total": qid}

if __name__ == "__main__":
    result = parse_wjx(sys.argv[1] if len(sys.argv) > 1 else "D:/claude/q1_raw.html")
    if result:
        print(f"Title: {result['title']}")
        print(f"Total questions: {result['total']}")
        for q in result['questions']:
            opt_preview = " | ".join(q['options'][:3])
            if len(q['options']) > 3:
                opt_preview += f" ... (+{len(q['options'])-3})"
            print(f"  Q{q['id']}[pg{q['pg']}] {q['type']} {q['note']}: {q['q'][:80]}...")
            print(f"    Options({len(q['options'])}): {opt_preview}")
