# Preview stills: python3 scripts/hero-film/preview.py <outdir>
import sys, pathlib
from playwright.sync_api import sync_playwright
out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
scene = pathlib.Path(__file__).with_name("scene.html").resolve().as_uri()
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1280, "height": 720})
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(scene)
    f = pg.evaluate("window.FILM")
    for i, name in enumerate(f["ORDER"]):
        pg.evaluate(f"FILM.draw({i * f['SEG'] + f['DWELL'] / 2})")
        pg.screenshot(path=str(out / f"{i}-{name.replace(' ', '')}.jpg"), type="jpeg", quality=88)
    pg.evaluate(f"FILM.draw({f['DWELL'] + f['TRAVEL'] / 2})"); pg.screenshot(path=str(out / "travel.jpg"), type="jpeg", quality=88)
    print(f, errs); b.close()
