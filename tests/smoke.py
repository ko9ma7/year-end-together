"""Render without external browser navigation (useful in sandboxed environments)."""
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
html = (root / 'index.html').read_text(encoding='utf-8')
css = (root / 'styles.css').read_text(encoding='utf-8')
config = (root / 'config.js').read_text(encoding='utf-8')
app = (root / 'app.js').read_text(encoding='utf-8')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in (320, 375, 430, 768, 1024, 1440):
        page = browser.new_page(viewport={'width': width, 'height': 900}, device_scale_factor=1)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.set_content(html)
        page.add_style_tag(content=css)
        page.add_script_tag(content=config)
        page.add_script_tag(content=app)
        page.locator('.event-card').first.wait_for(timeout=5000)
        page.locator('.event-card').first.click()
        page.get_by_role('heading', name='가능한 날짜를 골라주세요').wait_for()
        page.locator('.day.available').first.click()
        page.locator('#attendee-name').fill('김모임')
        page.locator('#consent').check()
        page.locator('#response-form button[type=submit]').click()
        page.locator('.participant-list').get_by_text('김모임').wait_for(timeout=5000)
        assert page.locator('.day.selected').count() == 1
        assert page.locator('#attendee-name').input_value() == '김모임'
        horizontal_overflow = page.evaluate('document.documentElement.scrollWidth > window.innerWidth + 2')
        if errors or horizontal_overflow:
            print(f'FAIL width={width}, errors={errors}, overflow={horizontal_overflow}')
            raise SystemExit(1)
        if width == 375:
            page.screenshot(path='/mnt/data/year-end-mobile.png', full_page=True)
        if width == 1440:
            page.screenshot(path='/mnt/data/year-end-desktop.png', full_page=True)
        print(f'PASS {width}px: calendar, submit, participants, responsive, no JS errors')
        page.close()
    browser.close()
