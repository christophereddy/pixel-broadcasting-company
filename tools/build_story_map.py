# Builds the newsroom's offline map data: news/world-map.bin (a 0.25-degree grid of which country or
# US state covers each cell) and news/places.js (the names, label points and cities the page looks
# stories up in). The page never calls a map service; these two files are all it uses.
#
# Only needs running again if the map itself should change. In a scratch folder:
#   npm i world-atlas us-atlas all-the-cities topojson-client
#   node -e '<see dump() below>'   (or run this script with --dump, which does it for you)
#   python3 tools/build_story_map.py <scratch folder>
# Sources: Natural Earth 1:50m countries (public domain, via world-atlas), US Census state outlines
# (public domain, via us-atlas), and city points from GeoNames (CC BY 4.0, via all-the-cities).
import json, os, subprocess, sys, zlib, unicodedata
import numpy as np
from PIL import Image, ImageDraw

RES = 0.25
W, H = int(360 / RES), int(180 / RES)
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "news")
sys.path.insert(0, HERE)
from cities import US as DESK_US

DUMP = r'''
const fs=require("fs"),topo=require("topojson-client");
const w=require("world-atlas/countries-50m.json"),u=require("us-atlas/states-10m.json");
fs.writeFileSync("world.geojson",JSON.stringify(topo.feature(w,w.objects.countries)));
fs.writeFileSync("states.geojson",JSON.stringify(topo.feature(u,u.objects.states)));
const c=require("all-the-cities").filter(x=>x.country==="US"?x.population>=100000:(x.population>=300000||x.featureCode==="PPLC"))
  .map(x=>[x.name,x.loc.coordinates[1],x.loc.coordinates[0],x.population,x.country]);
fs.writeFileSync("cities.json",JSON.stringify(c));
'''

def ascii(s):
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()

def main(src):
    os.chdir(src)
    if "--dump" in sys.argv or not os.path.exists("cities.json"):
        subprocess.run(["node", "-e", DUMP], check=True)
    world = json.load(open("world.geojson"))["features"]
    states = json.load(open("states.geojson"))["features"]
    territories = {"American Samoa", "Guam", "Commonwealth of the Northern Mariana Islands", "Puerto Rico", "United States Virgin Islands"}
    feats = [(f["properties"]["name"], "", f["geometry"]) for f in world if f["properties"]["name"] not in ("United States of America", "Antarctica")]
    feats += [(f["properties"]["name"], "US", f["geometry"]) for f in states if f["properties"]["name"] not in territories]

    def polys(g):
        return g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    def area(g):
        xs = [x for p in polys(g) for x, _ in p[0]]; ys = [y for p in polys(g) for _, y in p[0]]
        return (max(xs) - min(xs)) * (max(ys) - min(ys))
    # Biggest first, so an enclave (Lesotho, San Marino) is drawn after the country around it.
    order = sorted(range(len(feats)), key=lambda i: -area(feats[i][2]))
    img = Image.new("I", (W, H), 0); d = ImageDraw.Draw(img)
    ring = lambda r: [((x + 180) / RES, (90 - y) / RES) for x, y in r]
    for i in order:
        for p in polys(feats[i][2]):
            d.polygon(ring(p[0]), fill=i + 1)
            for h in p[1:]: d.polygon(ring(h), fill=0)
    grid = np.array(img, dtype=np.uint16)

    # Label point per region: the most inland cell of its biggest piece, so France pins in France, not French Guiana.
    regions = []
    for i, (name, parent, g) in enumerate(feats):
        m = grid == i + 1
        if not m.any():   # too small for a 0.25-degree cell: use the first vertex
            x, y = polys(g)[0][0][0]; regions.append([name, round(y, 2), round(x, 2), parent]); continue
        depth = np.zeros(m.shape, np.int32); cur = m.copy(); k = 0
        while cur.any():
            k += 1; depth[cur] = k
            nb = cur.copy()
            nb[1:] &= cur[:-1]; nb[:-1] &= cur[1:]; nb[:, 1:] &= cur[:, :-1]; nb[:, :-1] &= cur[:, 1:]
            cur = nb
        r, c = np.unravel_index(np.argmax(depth), depth.shape)
        regions.append([name, round(90 - (r + .5) * RES, 2), round((c + .5) * RES - 180, 2), parent])

    def region_at(lat, lon):
        r, c = int((90 - lat) / RES), int((lon + 180) / RES) % W
        return int(grid[min(H - 1, max(0, r)), c])

    # Cities: the biggest place for each name, tagged with the region it sits in.
    best = {}
    for n, la, lo, pop, cc in json.load(open("cities.json")):
        key = (ascii(n), cc == "US")
        if key not in best or best[key][3] < pop: best[key] = [ascii(n), la, lo, pop]
    for n, st, sh, tz, la, lo in DESK_US:
        best[(ascii(n), True)] = [ascii(n), la, lo, 10**9]
    cities = []
    for (n, us), (_, la, lo, pop) in sorted(best.items()):
        rid = region_at(la, lo)
        if rid: cities.append([n, round(la, 2), round(lo, 2), rid, 1 if us else 0])

    raw = grid.astype("<u2").tobytes(); z = zlib.compressobj(9, zlib.DEFLATED, -15)
    open(os.path.join(OUT, "world-map.bin"), "wb").write(z.compress(raw) + z.flush())
    with open(os.path.join(OUT, "places.js"), "w") as f:
        f.write("/* Generated by tools/build_story_map.py: do not edit by hand. Natural Earth + US Census outlines (public domain),\n"
                "   city points from GeoNames (CC BY 4.0). regions[id-1] = [name, label lat, label lon, \"US\" for a state];\n"
                "   cities = [name, lat, lon, region id, 1 if in the US]. */\n")
        f.write("window.PBC_PLACES={res:%s,w:%d,h:%d,regions:%s,\ncities:%s};\n" % (RES, W, H, json.dumps(regions, separators=(",", ":"), ensure_ascii=False), json.dumps(cities, separators=(",", ":"))))
    print(len(regions), "regions,", len(cities), "cities")

if __name__ == "__main__":
    main(sys.argv[1])
