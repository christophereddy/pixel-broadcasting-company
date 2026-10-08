# Merges one refresh's gathered stories into data/feed.json and data/locals.json, in place.
#   python3 tools/merge.py SCRATCH_DIR [FEEDS_DIR]
# SCRATCH_DIR holds the gatherers' output: news.json (world, international, national, politics, goodnews, sources),
# bss.json (business, science, sports, goodnews, sources) and any number of locals_*.json files shaped
# {slug: {local, weather, goodnews, sources}}. See tools/REFRESH.md.
# It applies the age rules, falls back to still-fresh previous stories when a source came back empty,
# and opens a new city desk when a locals_* file names a slug from cities.py that has no desk yet.
# FEEDS_DIR is a checkout of the feeds branch (default: a `feeds` folder next to SCRATCH_DIR, then /tmp/feeds, then the
# branch itself via git). A story that names its article `url` gets the publisher, title and times from there.
import json, glob, os, re, sys, subprocess, datetime as dt
from urllib.parse import urlparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cities import places

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FEED, LOCALS = f'{REPO}/data/feed.json', f'{REPO}/data/locals.json'
R = sys.argv[1] if len(sys.argv) > 1 else '.'

now = dt.datetime.now(dt.timezone.utc).replace(second=0, microsecond=0); NOW = now.strftime('%Y-%m-%dT%H:%M:%SZ')

def load(p, default):
    return json.load(open(p)) if os.path.exists(p) else default

def ok(s, hours):
    try: d = dt.datetime.strptime(s.get('date', ''), '%Y-%m-%d').replace(tzinfo=dt.timezone.utc)
    except Exception: return False
    return now - d <= dt.timedelta(hours=hours + 24)  # date-only: allow the whole publish day

def iso(v):
    """An ISO 8601 time as UTC 'YYYY-MM-DDTHH:MM:SSZ', or None when it isn't one (date-only values are not times)."""
    if not isinstance(v, str) or not re.match(r'\d{4}-\d\d-\d\dT\d\d:\d\d', v): return None
    try: t = dt.datetime.fromisoformat(v.strip().replace('Z', '+00:00'))
    except ValueError: return None
    return (t if t.tzinfo else t.replace(tzinfo=dt.timezone.utc)).astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

# The article behind each story, for the newsroom's Current story card. All optional; a missing one shows as unknown.
# gathered is when PBC first gathered the article: kept from an earlier refresh when the same article comes back,
# otherwise the gatherer's value, otherwise this refresh (only for stories gathered this time, never for carried-over ones).
FIRST = {}

def ukey(u):
    try: p = urlparse(u.strip()); return (p.hostname or '').lower().removeprefix('www.') + p.path.rstrip('/')
    except Exception: return ''

def feed_files():
    """(name, json) for each source file of the feeds branch."""
    for d in [sys.argv[2]] if len(sys.argv) > 2 else [os.path.join(os.path.dirname(os.path.abspath(R)), 'feeds'), '/tmp/feeds']:
        if os.path.exists(f'{d}/index.json'):
            return [(f, json.load(open(f))) for f in glob.glob(f'{d}/*.json') if not f.endswith('index.json')]
    try:
        g = lambda *a: subprocess.run(['git', '-C', REPO, *a], capture_output=True, text=True, timeout=60)
        g('fetch', '-q', '--depth', '1', 'origin', '+feeds:refs/remotes/origin/feeds')
        names = [n for n in g('ls-tree', '--name-only', 'origin/feeds').stdout.split() if n.endswith('.json') and n != 'index.json']
        return [(n, json.loads(g('show', f'origin/feeds:{n}').stdout)) for n in names]
    except Exception: return []

# What the feeds know about each article: url key -> publisher, title, published, updated, gathered
KNOWN = {}
for _, f in feed_files():
    if not isinstance(f, dict): continue
    pub, got = f.get('name'), iso(f.get('fetchedAt'))
    for a in f.get('articles') or []:
        t = ' '.join(str(a.get('title', '')).split()); m = re.search(r'\s+[|\u2013\u2014:-]\s+([^|\u2013\u2014:-]{2,40})$', t)
        if m and set(re.findall(r'[a-z]{3,}', m[1].lower())) & set(re.findall(r'[a-z]{3,}', str(pub).lower())): t = t[:m.start()]  # drop " | Site name"
        if len(re.findall(r'[a-z][A-Z]', t)) >= 3: t = ''  # menu and icon labels run together (feeds fetched before fetch_sources.py took the page's own title)
        KNOWN.setdefault(ukey(a.get('url', '')), {'publisher': pub, 'title': t, 'published': a.get('published'), 'updated': a.get('updated'), 'gathered': got})
    for i in f.get('items') or []:
        KNOWN.setdefault(ukey(i.get('link', '')), {'publisher': pub, 'title': i.get('title'), 'published': i.get('date'), 'gathered': got})
KNOWN.pop('', None)
for k in KNOWN.values():   # a publish day with no time came through as midnight UTC before the same fix: not a real time
    for f in ('published', 'updated'):
        if str(k.get(f) or '').endswith('T00:00:00Z'): k[f] = None
MISSING = []

def article(s, x, gathered_now):
    k = KNOWN.get(ukey(s['url'])) if isinstance(s.get('url'), str) else None
    if k: s = dict({a: b for a, b in k.items() if b}, **{a: b for a, b in s.items() if b})  # the story's own values win
    if isinstance(s.get('publisher'), str) and s['publisher'].strip(): x['publisher'] = s['publisher'].strip()[:80]
    if isinstance(s.get('title'), str) and s['title'].strip(): x['title'] = ' '.join(s['title'].split())[:200]
    if isinstance(s.get('url'), str) and re.match(r'^https://[^\s"<>]+$', s['url']) and len(s['url']) <= 500: x['url'] = s['url']
    for k in ('published', 'updated'):
        if iso(s.get(k)): x[k] = iso(s.get(k))
    got = [g for g in (FIRST.get(x.get('url')), FIRST.get(x['h']), iso(s.get('gathered'))) if g]
    if got: x['gathered'] = min(got)
    elif gathered_now: x['gathered'] = NOW
    if gathered_now and 'url' not in x: MISSING.append(x['h'])

def clean(lst, hours=24, need_place=False, fresh=False):
    out = []
    for s in lst or []:
        if isinstance(s, dict) and not s.get('date') and iso(s.get('published')): s = dict(s, date=iso(s['published'])[:10])
        if not (isinstance(s, dict) and s.get('h') and s.get('b') and ok(s, hours)): continue
        if need_place and not (s.get('place') and s.get('tz')): continue
        x = {'h': s['h'], 'b': s['b'], 'date': s['date']}
        m = s.get('more') or []; m = re.split(r'(?<=[.!?"])\s+(?=[A-Z"])', m) if isinstance(m, str) else m  # gatherers sometimes send one string
        m = [t for t in m if isinstance(t, str) and len(t.strip()) > 2][:3]
        if m: x['more'] = m
        if need_place: x['place'] = s['place']; x['tz'] = s['tz']
        elif isinstance(s.get('place'), str) and s['place'].strip(): x['place'] = s['place'].strip()[:60]  # pinned on the news wall's map
        article(s, x, fresh)
        out.append(x)
    return out

def pick(new, prev, hours=24, need_place=False):
    return clean(new, hours, need_place, fresh=True) or clean(prev, hours, need_place)

def wx(new):
    if new and isinstance(new.get('periods'), list) and (new.get('now') or new['periods']):
        return {'now': new.get('now'), 'periods': new['periods'][:6]}
    return {'now': None, 'periods': []}  # previous periods have ended by now

news, bss = load(f'{R}/news.json', {}), load(f'{R}/bss.json', {})
loc = {}
for f in sorted(glob.glob(f'{R}/locals_*.json')): loc.update(json.load(open(f)))
old = json.load(open(FEED))
desks = {d['slug']: d for d in json.load(open(LOCALS))}
for lst in [v for v in old.values() if isinstance(v, list)] + [d.get(k) or [] for d in desks.values() for k in ('local', 'goodnews')]:
    for s in lst:
        g = isinstance(s, dict) and iso(s.get('gathered'))
        if not g: continue
        for k in (s.get('url'), s.get('h')):
            if k and (k not in FIRST or g < FIRST[k]): FIRST[k] = g

# National desks
feed = {'updatedAt': NOW, 'location': old['location']}
for k in ['world', 'national', 'politics']: feed[k] = pick(news.get(k), old.get(k))
feed['international'] = pick(news.get('international'), old.get('international'), need_place=True)
for k in ['business', 'science']: feed[k] = pick(bss.get(k), old.get(k))
feed['sports'] = pick(bss.get('sports'), old.get('sports'), 48)
# Good News: only real, positive, sourced stories the gatherers flagged; nothing invented. Empty list = no segment.
feed['goodnews'] = pick((news.get('goodnews') or []) + (bss.get('goodnews') or []), old.get('goodnews'))[:4]
gh = {g['h'] for g in feed['goodnews']}
for k in ['world', 'national', 'politics', 'international', 'business', 'science', 'sports']:
    feed[k] = [x for x in feed[k] if x['h'] not in gh]

# New city desks: a gathered slug that is in cities.py but has no desk yet
P = {c['id']: c for c in places()}
for slug, n in loc.items():
    if slug in desks: continue
    c = P.get(slug)
    srcs = [dict(s, desk='local') for s in n.get('sources', []) if str(s.get('url', '')).startswith('https://')]
    if not c or not srcs or not clean(n.get('local')):
        print('skipped new desk', slug, '(not in cities.py, no https sources, or no fresh local stories)'); continue
    desks[slug] = {'slug': slug, 'location': {'name': c['name'], 'short': c['short'], 'tz': c['tz']}, 'local': [], 'goodnews': [], 'weather': {'now': None, 'periods': []}, 'sources': srcs}

# Every city desk
report = {}
for slug, d in desks.items():
    n = loc.get(slug, {})
    d['goodnews'] = pick(n.get('goodnews'), d.get('goodnews'))[:3]
    g = {x['h'] for x in d['goodnews']}
    d['local'] = [x for x in pick(n.get('local'), d.get('local')) if x['h'] not in g]
    d['weather'] = wx(n.get('weather'))
    d['updatedAt'] = NOW
    report[slug] = (len(d['local']), len(d['weather']['periods']), bool(d['weather']['now']))

# The feed's own local desk mirrors the default city (the one named in feed.location)
home = next((d for d in desks.values() if d['location']['name'] == feed['location']['name']), None)
if home: feed['local'], feed['weather'], feed['localgood'] = home['local'], home['weather'], home['goodnews']
else: feed['local'], feed['weather'], feed['localgood'] = [], {'now': None, 'periods': []}, []

src = list(home['sources']) if home else [s for s in old.get('sources', []) if s.get('desk') == 'local']
seen = set()
for s in news.get('sources', []) + bss.get('sources', []):
    if s.get('name') and s['name'] not in seen and 'monitor' not in s['name'].lower():  # never the Christian Science Monitor
        seen.add(s['name']); src.append({'name': s['name'], 'url': s['url']})
feed['sources'] = src

json.dump(feed, open(FEED, 'w'), ensure_ascii=False, indent=1)
json.dump(sorted(desks.values(), key=lambda d: d['slug']), open(LOCALS, 'w'), ensure_ascii=False, indent=1)
print({k: len(v) for k, v in feed.items() if isinstance(v, list)}); print(report)
print(f'article details from the feeds for {len(KNOWN)} links')
if MISSING:
    print(f'WARNING: {len(set(MISSING))} new stories have no article url, so the Current story card shows no publisher, time or link for them.'
          ' Give every story the `url` of the article it came from (tools/REFRESH.md step 2a). First few:', sorted(set(MISSING))[:5])
