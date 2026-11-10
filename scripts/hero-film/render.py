# Render the hero film: python3 scripts/hero-film/render.py
# Films scene.html one city segment at a time, joins them, and writes
# public/video/cities.mp4, cities-mobile.mp4 and public/img/scenes/cities-poster.jpg
import pathlib, subprocess, tempfile, os
from playwright.sync_api import sync_playwright
here = pathlib.Path(__file__).parent; root = here.parent.parent
FPS = 30
tmp = pathlib.Path(tempfile.mkdtemp(prefix="herofilm-"))
vid = root / "public/video"; vid.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1280, "height": 720})
    pg.goto((here / "scene.html").resolve().as_uri())
    f = pg.evaluate("window.FILM"); per = round(f["SEG"] * FPS); parts = []
    for i, name in enumerate(f["ORDER"]):
        part = tmp / f"part{i}.tmp.mp4"
        ff = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "mjpeg", "-i", "-",
            "-c:v", "libx264", "-crf", "23", "-preset", "slow", "-pix_fmt", "yuv420p", "-r", str(FPS), "-g", str(per), "-an", str(part)], stdin=subprocess.PIPE)
        for k in range(per):
            pg.evaluate(f"FILM.draw({(i * per + k) / FPS})")
            ff.stdin.write(pg.screenshot(type="jpeg", quality=92))
        ff.stdin.close()
        assert ff.wait() == 0
        done = tmp / f"part{i}.mp4"; os.rename(part, done); parts.append(done); print("rendered", name, flush=True)
    pg.evaluate(f"FILM.draw({f['DWELL'] / 2})")
    pg.screenshot(path=str(root / "public/img/scenes/cities-poster.jpg"), type="jpeg", quality=86)
    b.close()
(tmp / "list.txt").write_text("".join(f"file '{x}'\n" for x in parts))
def run(*a): subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *a], check=True)
t = vid / "cities.tmp.mp4"; run("-f", "concat", "-safe", "0", "-i", str(tmp / "list.txt"), "-c", "copy", "-movflags", "+faststart", str(t)); os.rename(t, vid / "cities.mp4")
t = vid / "cities-mobile.tmp.mp4"; run("-i", str(vid / "cities.mp4"), "-vf", "scale=854:480", "-c:v", "libx264", "-crf", "26", "-preset", "slow", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", str(t)); os.rename(t, vid / "cities-mobile.mp4")
print("done")
