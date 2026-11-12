"""Rasterize the original logo marks for the shared image component."""
import base64
import json
import re
from pathlib import Path
import subprocess

assets = Path(__file__).resolve().parents[1] / 'packages/core/assets'
logos = {}
for key, filename in [('purpleLogo', 'dameeland-logo-white.svg'), ('limeLogo', 'dameeland-logo.svg'), ('loadingLogo', 'dameeland-logo.svg')]:
    svg = (assets / filename).read_text().split('<metadata')[0].split('</svg>')[0] + '</svg>'
    svg = re.sub(r'<rect\b[^>]*/>', '', svg, count=1)
    svg = svg.replace('viewBox="0 0 64 64"', 'viewBox="4 8 56 56"')
    svg = svg.replace('width="512" height="512"', 'width="144" height="144"')
    if key == 'loadingLogo':
        svg = re.sub(r'<circle\b[^>]*fill="#1B1233"[^>]*/>', '', svg)
    png = subprocess.check_output(
        ['inkscape', '--pipe', '--export-type=png', '--export-filename=-'],
        input=svg.encode(),
    )
    logos[key] = 'data:image/png;base64,' + base64.b64encode(png).decode()
(assets.parent / 'art.ts').write_text(
    '// Transparent marks generated from the original dameeland logos.\nexport const art = '
    + json.dumps(logos, indent=2)
    + ' as const\n'
)
