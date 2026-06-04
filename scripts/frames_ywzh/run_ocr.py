import easyocr, os, json

reader = easyocr.Reader(['ch_sim', 'en'], gpu=False)
frames_dir = "frames"
files = sorted([f for f in os.listdir(frames_dir) if f.endswith('.png')])

results = []
for i, fn in enumerate(files):
    path = os.path.join(frames_dir, fn)
    try:
        ocr = reader.readtext(path, detail=1)
        texts = []
        for bbox, text, conf in ocr:
            if conf > 0.3 and len(text.strip()) > 0:
                texts.append({"text": text.strip(), "conf": round(conf, 2)})
        if texts:
            results.append({"frame": fn, "texts": texts})
            print(f"[{i+1}/{len(files)}] {fn}: {len(texts)} texts")
    except Exception as e:
        print(f"[{i+1}/{len(files)}] {fn}: ERROR {e}")

with open("ocr_results.json", "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

# Also a readable text file
with open("ocr_results.txt", "w", encoding="utf-8") as f:
    for r in results:
        f.write(f"\n=== {r['frame']} ===\n")
        for t in r['texts']:
            f.write(f"  [{t['conf']:.2f}] {t['text']}\n")

print(f"\nDone: {len(results)} frames with text, saved to ocr_results.txt")
