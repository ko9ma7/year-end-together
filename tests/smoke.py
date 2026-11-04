"""Disconnected UI test: no fake events and disabled write controls."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root = Path(__file__).resolve().parents[1]
html = (root / 'index.html').read_text(encoding='utf-8').replace('<script src="./config.js" defer></script>', '').replace('<script src="./app.js" defer></script>', '').replace('<link rel="stylesheet" href="./styles.css">', '')
css = (root / 'styles.css').read_text(encoding='utf-8')
config = (root / 'config.js').read_text(encoding='utf-8')
app = (root / 'app.js').read_text(encoding='utf-8')
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in (320,375,430,768,1024,1440):
        page = browser.new_page(viewport={'width':width,'height':900})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.set_content(html)
        page.add_style_tag(content=css)
        page.add_script_tag(content=config)
        page.add_script_tag(content=app)
        page.locator('.event-empty').wait_for(timeout=5000)
        assert page.locator('.event-card').count() == 0
        page.locator('a[href="#create"]:visible').first.click()
        page.locator('input[name="adminKey"]').wait_for(timeout=2000)
        assert page.locator('#event-save-button').is_disabled()
        assert not errors, errors
        overflow = page.evaluate('document.documentElement.scrollWidth > window.innerWidth + 2')
        assert not overflow, width
        print(f'PASS offline UI {width}px: empty state, password form, save disabled, no overflow or JS errors')
        page.close()
    browser.close()
