#!/usr/bin/env python3
"""Prepare the static GitHub Pages artifact and resolve absolute social URLs."""
import os
import pathlib
import shutil
import sys
from html import escape

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / '_site'
if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir()
for name in ('index.html', '404.html', 'styles.css', 'app.js', 'config.js', 'manifest.webmanifest', 'robots.txt', '.nojekyll'):
    shutil.copy2(ROOT / name, OUT / name)
shutil.copytree(ROOT / 'assets', OUT / 'assets')

owner_repo = os.environ.get('GITHUB_REPOSITORY', '').strip()
custom_domain_file = ROOT / 'CNAME'
if custom_domain_file.is_file():
    domain = custom_domain_file.read_text(encoding='utf-8').strip()
    if domain and '/' not in domain and ' ' not in domain:
        site_url = f'https://{domain}/'
        shutil.copy2(custom_domain_file, OUT / 'CNAME')
    else:
        raise SystemExit('CNAME contains an invalid domain')
elif '/' in owner_repo:
    owner, repo = owner_repo.split('/', 1)
    if not owner or not repo:
        raise SystemExit('GITHUB_REPOSITORY must be owner/repo')
    site_url = f'https://{owner}.github.io/' + ('' if repo.lower() == f'{owner.lower()}.github.io' else f'{repo}/')
else:
    site_url = ''

html_path = OUT / 'index.html'
html = html_path.read_text(encoding='utf-8')
if site_url:
    full_og = site_url + 'assets/og-image.png'
    html = html.replace('content="./assets/og-image.png"', f'content="{escape(full_og, quote=True)}"')
    html = html.replace('<meta property="og:site_name"', f'<meta property="og:url" content="{escape(site_url, quote=True)}">\n  <link rel="canonical" href="{escape(site_url, quote=True)}">\n  <meta property="og:site_name"')
html_path.write_text(html, encoding='utf-8')
print(f'Prepared {OUT} for {site_url or "local preview"}')
