# Fetches Chris's approved news sources (tools/sources.json) and saves them as plain text/JSON in OUT_DIR,
# so the 3-hour refresh reads news from the repo's feeds branch instead of fetching sites itself.
#   python3 tools/fetch_sources.py OUT_DIR
# Run by .github/workflows/fetch-sources.yml. Standard library only. Never fetches a host that is not in
# sources.json's allowed_hosts. Writes OUT_DIR/index.json (what was fetched, when, and what failed),
# one OUT_DIR/<id>.json per source, and OUT_DIR/weather/<slug>.json per city desk.
import json, os, re, sys, time, html, datetime as dt
import urllib.request, urllib.error
from urllib.parse import urljoin, urlparse
from html.parser import HTMLParser
from email.utils import parsedate_to_datetime
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)

OUT = sys.argv[1] if len(sys.argv) > 1 else 'feeds'
CFG = json.load(open(f'{HERE}/sources.json'))
HOSTS = set(CFG['allowed_hosts'])
NOW = dt.datetime.now(dt.timezone.utc)
UA = 'Mozilla/5.0 (compatible; PixelBroadcastingCompany/1.0; +https://github.com/christophereddy/pixel-broadcasting-company)'
ARTICLES, ARTICLE_CHARS, PAGE_CHARS, MAX_AGE_H = 8, 6000, 15000, 36

def get(url):
    if urlparse(url).hostname not in HOSTS:
        raise ValueError(f'host not on the approved list: {url}')
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8'})
    for attempt in range(2):
        try:
            with urllib.request.urlopen(req, timeout=45) as r:
                final = r.geturl()
                if urlparse(final).hostname not in HOSTS:
                    raise ValueError(f'redirected off the approved list: {final}')
                return r.read().decode(r.headers.get_content_charset() or 'utf-8', 'replace')
        except urllib.error.HTTPError as e:
            if e.code < 500 or attempt: raise
        except (urllib.error.URLError, TimeoutError):
            if attempt: raise
        time.sleep(3)

SKIP = {'script', 'style', 'noscript', 'svg', 'nav', 'footer', 'header', 'form', 'iframe', 'button', 'aside'}
BLOCK = {'p', 'h1', 'h2', 'h3', 'h4', 'li', 'br', 'div', 'section', 'article', 'time', 'tr', 'figcaption'}

class Page(HTMLParser):
    """Visible text, links, and any publish dates a page declares."""
    def __init__(self, base):
        super().__init__(convert_charrefs=True)
        self.base, self.skip, self.text, self.links, self.dates, self.title, self._a, self._t = base, 0, [], [], [], '', None, False
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in SKIP: self.skip += 1
        if tag == 'title': self._t = True
        if tag == 'meta' and (a.get('property') or a.get('name') or '') in ('article:published_time', 'og:updated_time', 'date', 'pubdate', 'parsely-pub-date', 'article:modified_time'):
            self.dates.append(a.get('content') or '')
        if tag == 'time' and a.get('datetime'): self.dates.append(a['datetime'])
        if tag == 'a' and a.get('href'): self._a = [urljoin(self.base, a['href']).split('#')[0], '']; self.text.append(' ')
        if tag in BLOCK: self.text.append('\n')
    def handle_endtag(self, tag):
        if tag in SKIP and self.skip: self.skip -= 1
        if tag == 'title': self._t = False
        if tag == 'a' and self._a:
            if self._a[1].strip(): self.links.append((self._a[0], ' '.join(self._a[1].split())))
            self._a = None
    def handle_data(self, d):
        if self._t: self.title += d
        if self.skip: return
        self.text.append(d)
        if self._a: self._a[1] += d

def page_text(p, limit):
    t = re.sub(r'[ \t\r\f\v]+', ' ', ''.join(p.text))
    t = '\n'.join(l.strip() for l in t.split('\n') if len(l.strip()) > 1)
    return t[:limit]

def parse_page(url, body):
    p = Page(url); p.feed(body); return p

def when(s):
    """Best-effort ISO date from feed/meta strings; '' if unknown."""
    s = (s or '').strip()
    if not s: return ''
    try: return parsedate_to_datetime(s).astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    except Exception: pass
    try: return dt.datetime.fromisoformat(s.replace('Z', '+00:00')).astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    except Exception: return s[:25]

def fresh(iso):
    try: return NOW - dt.datetime.strptime(iso, '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=dt.timezone.utc) <= dt.timedelta(hours=MAX_AGE_H)
    except Exception: return True  # unknown date: keep it and let the refresh judge

def strip_tags(s):
    return ' '.join(html.unescape(re.sub(r'<[^>]+>', ' ', s or '')).split())

def parse_feed_loose(body):
    """Regex fallback for feeds that aren't valid XML (e.g. undeclared namespace prefixes)."""
    def tag(chunk, *names):
        for n in names:
            m = re.search(rf'<{n}\b[^>]*?(?:href="([^"]*)")?[^>]*>(.*?)</{n}>', chunk, re.S) or re.search(rf'<{n}\b[^>]*href="([^"]*)"', chunk)
            if m:
                g = m.groups(); v = (g[1] if len(g) > 1 and g[1] else '') or g[0] or ''
                return re.sub(r'^<!\[CDATA\[|\]\]>$', '', v.strip())
        return ''
    items = []
    for chunk in re.findall(r'<(?:item|entry)\b.*?</(?:item|entry)>', body, re.S):
        items.append({'title': strip_tags(tag(chunk, 'title')), 'link': tag(chunk, 'link'), 'date': when(tag(chunk, 'pubDate', 'published', 'updated', 'dc:date')), 'summary': strip_tags(tag(chunk, 'description', 'summary', 'content:encoded', 'content'))[:1200]})
    return items

def parse_feed(body):
    try: root = ET.fromstring(body.encode('utf-8'))
    except ET.ParseError: return parse_feed_loose(body)
    items = []
    for it in root.iter():
        tag = it.tag.split('}')[-1]
        if tag not in ('item', 'entry'): continue
        f = {c.tag.split('}')[-1]: c for c in it}
        link = f.get('link')
        href = (link.get('href') or (link.text or '')).strip() if link is not None else ''
        date = next((f[k].text for k in ('pubDate', 'published', 'updated', 'date') if k in f and f[k].text), '')
        summ = next((f[k].text for k in ('description', 'summary', 'content', 'encoded') if k in f and f[k].text), '')
        items.append({'title': strip_tags(f['title'].text if 'title' in f else ''), 'link': href, 'date': when(date), 'summary': strip_tags(summ)[:1200]})
    return items

def looks_like_article(u, src_url):
    pu, ps = urlparse(u), urlparse(src_url)
    if pu.hostname != ps.hostname or pu.query: return False
    path = pu.path.rstrip('/')
    if path in ('', ps.path.rstrip('/')): return False
    if re.search(r'/(tag|tags|category|categories|author|authors|topic|topics|about|contact|donate|support|newsletters?|podcasts?|video|videos|watch|live|shows?|search|login|subscribe|events?|careers|privacy|terms)(/|$)', path): return False
    last = path.split('/')[-1]
    return bool(re.search(r'/20\d\d/', path)) or last.count('-') >= 4

def fetch_article(u):
    p = parse_page(u, get(u))
    return {'url': u, 'title': ' '.join(p.title.split()), 'dates': sorted({when(d) for d in p.dates if d})[:4], 'text': page_text(p, ARTICLE_CHARS)}

def fetch_source(src):
    out = {'name': src['name'], 'url': src['url'], 'fetchedAt': NOW.strftime('%Y-%m-%dT%H:%M:%SZ')}
    body = get(src['url'])
    if body.lstrip()[:200].lstrip('﻿').startswith('<?xml') or re.match(r'\s*<(rss|feed)\b', body):
        items = parse_feed(body)
        out['kind'], out['items'] = 'feed', items[:40]
        picks = [i['link'] for i in items if i['link'] and fresh(i['date'])][:ARTICLES]
    else:
        p = parse_page(src['url'], body)
        out['kind'], out['title'], out['text'] = 'page', ' '.join(p.title.split()), page_text(p, PAGE_CHARS)
        out['pageDates'] = sorted({when(d) for d in p.dates if d})[-10:]
        seen, picks = set(), []
        for u, label in p.links:
            if u not in seen and looks_like_article(u, src['url']):
                seen.add(u); picks.append(u)
        out['links'] = [{'url': u, 'text': t} for u, t in p.links if u in seen][:60]
        picks = picks[:ARTICLES]
    out['articles'], out['articleErrors'] = [], []
    for u in picks:
        try: out['articles'].append(fetch_article(u))
        except Exception as e: out['articleErrors'].append({'url': u, 'error': str(e)[:200]})
        time.sleep(1)
    return out

def dn_urls(s):
    """Democracy Now! headlines for today's US date, else yesterday's."""
    for days in (0, 1):
        d = (NOW - dt.timedelta(hours=5) - dt.timedelta(days=days))
        yield s['url'].format(Y=d.year, M=d.month, D=d.day)

def main():
    os.makedirs(f'{OUT}/weather', exist_ok=True)
    index = {'fetchedAt': NOW.strftime('%Y-%m-%dT%H:%M:%SZ'), 'ok': [], 'failed': []}
    def save(name, data): json.dump(data, open(f'{OUT}/{name}.json', 'w'), ensure_ascii=False, indent=1)
    def run(key, src, file):
        urls = (list(dn_urls(src)) if '{Y}' in src['url'] else [src['url']]) + src.get('fallbacks', [])
        err, weak = '', None
        for u in urls:
            try:
                data = fetch_source({**src, 'url': u}); data['for'] = src.get('for', ['local'])
                if not (data.get('items') or data['articles']):  # nothing usable: try the next URL, keep this as a last resort
                    weak = weak or (u, data); err = f'{u}: no stories found'; continue
                save(file, data)
                index['ok'].append({'id': key, 'file': f'{file}.json', 'url': u, 'items': len(data.get('items', [])), 'articles': len(data['articles'])}); return
            except Exception as e: err = f'{u}: {e}'[:300]
        if weak:
            save(file, weak[1])
            index['ok'].append({'id': key, 'file': f'{file}.json', 'url': weak[0], 'items': 0, 'articles': 0, 'note': 'page text only, no stories found'}); return
        index['failed'].append({'id': key, 'url': src['url'], 'error': err})
    for s in CFG['national']:
        run(s['id'], s, s['id'])
    for slug, s in CFG['local'].items():
        run(f'local:{slug}', s, f'local-{slug}')
    # Weather: each desk's NWS forecast from its sources in data/locals.json (JSON form); listed pages for the rest.
    desks = json.load(open(f'{REPO}/data/locals.json'))
    for d in desks:
        slug = d['slug']
        try:
            if slug in CFG['weather']:
                w = CFG['weather'][slug]
                p = parse_page(w['url'], get(w['url']))
                data = {'name': w['name'], 'url': w['url'], 'kind': 'page', 'text': page_text(p, PAGE_CHARS)}
            else:
                nws = next((s['url'] for s in d.get('sources', []) if 'forecast.weather.gov/MapClick.php' in s['url']), '')
                if not nws: continue
                u = nws + ('&' if '?' in nws else '?') + 'FcstType=json'
                data = {'name': 'National Weather Service', 'url': u, 'kind': 'nws-json', 'forecast': json.loads(get(u))}
            data['fetchedAt'] = NOW.strftime('%Y-%m-%dT%H:%M:%SZ')
            json.dump(data, open(f'{OUT}/weather/{slug}.json', 'w'), ensure_ascii=False, indent=1)
            index['ok'].append({'id': f'weather:{slug}', 'file': f'weather/{slug}.json', 'url': data['url']})
        except Exception as e:
            index['failed'].append({'id': f'weather:{slug}', 'error': str(e)[:300]})
    save('index', index)
    print(f"fetched {len(index['ok'])}, failed {len(index['failed'])}")
    for f in index['failed']: print('  FAILED', f['id'], f.get('error', ''))

if __name__ == '__main__':
    main()
