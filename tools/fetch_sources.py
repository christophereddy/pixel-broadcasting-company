# Saves a readable copy of every approved source into OUT_DIR, for the 3-hour refresh to read instead of
# fetching news sites itself. Run by .github/workflows/fetch-sources.yml, which pushes OUT_DIR to the `feeds` branch.
#   python3 tools/fetch_sources.py OUT_DIR
# Sources: tools/sources.txt plus each city desk's National Weather Service page from data/locals.json.
# For RSS/Atom feeds it writes one block per item (title, date, link, summary); for web pages, the page text with links.
# index.json lists every source with its file, HTTP status and fetch time.
import json, os, re, sys, datetime as dt, urllib.request, html
from html.parser import HTMLParser
from urllib.parse import urlparse, urljoin
import xml.etree.ElementTree as ET

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else 'feeds'
UA = 'Mozilla/5.0 (compatible; PixelBroadcastingCompany/1.0; +https://christophereddy.github.io/pixel-broadcasting-company/)'
LIMIT = 150_000  # characters kept per source

def sources():
    urls = [l.strip() for l in open(f'{REPO}/tools/sources.txt') if l.strip() and not l.startswith('#')]
    for d in json.load(open(f'{REPO}/data/locals.json')):
        for s in d.get('sources', []):
            if urlparse(s.get('url', '')).hostname == 'forecast.weather.gov' and s['url'] not in urls: urls.append(s['url'])
    return [u for u in urls if 'csmonitor' not in u]

def slug(u):
    p = urlparse(u); return re.sub(r'[^a-z0-9]+', '-', (p.hostname + p.path + ('-' + p.query if p.query else '')).lower()).strip('-')[:80]

class Text(HTMLParser):
    SKIP = {'script', 'style', 'noscript', 'svg', 'nav', 'footer', 'form', 'iframe'}
    BLOCK = {'p', 'div', 'li', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'tr', 'article', 'section', 'time', 'header'}
    def __init__(self, base): super().__init__(); self.base, self.out, self.skip, self.href = base, [], 0, None
    def handle_starttag(self, t, a):
        a = dict(a)
        if t in self.SKIP: self.skip += 1
        if t in self.BLOCK: self.out.append('\n')
        if t == 'a' and a.get('href'): self.href = urljoin(self.base, a['href'])
        if t == 'time' and a.get('datetime'): self.out.append(f"[{a['datetime']}] ")
    def handle_endtag(self, t):
        if t in self.SKIP and self.skip: self.skip -= 1
        if t == 'a' and self.href: self.out.append(f' <{self.href}>'); self.href = None
    def handle_data(self, d):
        if not self.skip and d.strip(): self.out.append(d.strip() + ' ')
    def text(self): return re.sub(r'\n\s*\n+', '\n', ''.join(self.out)).strip()

def feed_text(raw):
    root = ET.fromstring(raw); out = []
    for it in root.iter():
        if it.tag.split('}')[-1] not in ('item', 'entry'): continue
        f = {c.tag.split('}')[-1]: c for c in it}
        g = lambda *ks: next(((f[k].text or f[k].get('href') or '').strip() for k in ks if k in f), '')
        summ = re.sub(r'<[^>]+>', ' ', html.unescape(g('description', 'summary', 'content', 'encoded')))
        summ = re.sub(r'\s+', ' ', summ).strip()[:1500]
        out.append(f"TITLE: {g('title')}\nDATE: {g('pubDate', 'published', 'updated', 'date')}\nLINK: {g('link', 'id')}\nSUMMARY: {summ}\n")
    return '\n'.join(out)

def fetch(u):
    req = urllib.request.Request(u, headers={'User-Agent': UA, 'Accept': '*/*'})
    with urllib.request.urlopen(req, timeout=30) as r: return r.status, r.headers.get('Content-Type', ''), r.read()

os.makedirs(OUT, exist_ok=True)
now = dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'); index = []
for u in sources():
    row = {'url': u, 'file': slug(u) + '.txt', 'fetchedAt': now}
    try:
        status, ctype, raw = fetch(u); row['status'] = status
        body = raw.decode('utf-8', 'replace')
        is_feed = 'xml' in ctype or body.lstrip()[:200].lower().startswith(('<?xml', '<rss', '<feed'))
        try: text = feed_text(raw) if is_feed else None
        except ET.ParseError: text = None
        if not text: p = Text(u); p.feed(body); text = p.text()
        open(f"{OUT}/{row['file']}", 'w').write(f'SOURCE: {u}\nFETCHED: {now}\n\n' + text[:LIMIT])
        row['chars'] = len(text)
    except Exception as e:
        row['status'], row['error'] = getattr(e, 'code', 0), str(e)[:200]
    index.append(row); print(row.get('status'), row.get('chars', row.get('error')), u)
json.dump({'fetchedAt': now, 'sources': index}, open(f'{OUT}/index.json', 'w'), indent=1)
