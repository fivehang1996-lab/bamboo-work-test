import cv2, os
os.makedirs("frames", exist_ok=True)
cap = cv2.VideoCapture("ywzh_video.f30032.mp4")
fps = cap.get(cv2.CAP_PROP_FPS)
total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
print(f"FPS: {fps:.1f}, Total frames: {total}, Duration: {total/fps:.1f}s")

interval = int(fps * 1.5)  # every 1.5 seconds
count = 0
saved = 0
while True:
    ret, frame = cap.read()
    if not ret:
        break
    if count % interval == 0:
        out = f"frames/f{count:05d}.png"
        cv2.imwrite(out, frame)
        saved += 1
    count += 1
cap.release()
print(f"Saved {saved} frames")
