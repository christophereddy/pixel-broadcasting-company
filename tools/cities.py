# The places a city desk can be opened for. merge.py looks a new desk's name, short code and
# time zone up here. Each entry: id, display name, region, country, short code, IANA time zone, lat, lon.
# Run it to search the list: python3 tools/cities.py boston
import re, sys, unicodedata

ET, CT, MT, PT = "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles"
US = [
 ("New York City","NY","NYC",ET,40.7128,-74.0060),("Los Angeles","CA","LA",PT,34.0522,-118.2437),("Chicago","IL","CHI",CT,41.8781,-87.6298),
 ("Houston","TX","HOU",CT,29.7604,-95.3698),("Phoenix","AZ","PHX","America/Phoenix",33.4484,-112.0740),("Philadelphia","PA","PHL",ET,39.9526,-75.1652),
 ("San Antonio","TX","SA",CT,29.4241,-98.4936),("San Diego","CA","SD",PT,32.7157,-117.1611),("Dallas","TX","DAL",CT,32.7767,-96.7970),
 ("Austin","TX","ATX",CT,30.2672,-97.7431),("Jacksonville","FL","JAX",ET,30.3322,-81.6557),("Fort Worth","TX","FTW",CT,32.7555,-97.3308),
 ("San Jose","CA","SJ",PT,37.3382,-121.8863),("Columbus","OH","CBUS",ET,39.9612,-82.9988),("Charlotte","NC","CLT",ET,35.2271,-80.8431),
 ("Indianapolis","IN","INDY","America/Indiana/Indianapolis",39.7684,-86.1581),("San Francisco","CA","SF",PT,37.7749,-122.4194),
 ("Seattle","WA","SEA",PT,47.6062,-122.3321),("Denver","CO","DEN",MT,39.7392,-104.9903),("Oklahoma City","OK","OKC",CT,35.4676,-97.5164),
 ("Nashville","TN","NASH",CT,36.1627,-86.7816),("Washington","DC","DC",ET,38.9072,-77.0369),("El Paso","TX","ELP",MT,31.7619,-106.4850),
 ("Las Vegas","NV","LV",PT,36.1699,-115.1398),("Boston","MA","BOS",ET,42.3601,-71.0589),("Detroit","MI","DET","America/Detroit",42.3314,-83.0458),
 ("Portland","OR","PDX",PT,45.5152,-122.6784),("Louisville","KY","LOU","America/Kentucky/Louisville",38.2527,-85.7585),("Memphis","TN","MEM",CT,35.1495,-90.0490),
 ("Baltimore","MD","BAL",ET,39.2904,-76.6122),("Milwaukee","WI","MKE",CT,43.0389,-87.9065),("Albuquerque","NM","ABQ",MT,35.0844,-106.6504),
 ("Tucson","AZ","TUC","America/Phoenix",32.2226,-110.9747),("Fresno","CA","FRES",PT,36.7378,-119.7871),("Sacramento","CA","SAC",PT,38.5816,-121.4944),
 ("Kansas City","MO","KC",CT,39.0997,-94.5786),("Mesa","AZ","MESA","America/Phoenix",33.4152,-111.8315),("Atlanta","GA","ATL",ET,33.7490,-84.3880),
 ("Omaha","NE","OMA",CT,41.2565,-95.9345),("Colorado Springs","CO","COS",MT,38.8339,-104.8214),("Raleigh","NC","RAL",ET,35.7796,-78.6382),
 ("Miami","FL","MIA",ET,25.7617,-80.1918),("Virginia Beach","VA","VB",ET,36.8529,-75.9780),("Long Beach","CA","LB",PT,33.7701,-118.1937),
 ("Oakland","CA","OAK",PT,37.8044,-122.2712),("Minneapolis","MN","MPLS",CT,44.9778,-93.2650),("Tulsa","OK","TUL",CT,36.1540,-95.9928),
 ("Tampa","FL","TPA",ET,27.9506,-82.4572),("Arlington","TX","ARL",CT,32.7357,-97.1081),("New Orleans","LA","NOLA",CT,29.9511,-90.0715),
 ("Wichita","KS","ICT",CT,37.6872,-97.3301),("Cleveland","OH","CLE",ET,41.4993,-81.6944),("Bakersfield","CA","BAK",PT,35.3733,-119.0187),
 ("Honolulu","HI","HNL","Pacific/Honolulu",21.3069,-157.8583),("Anchorage","AK","ANC","America/Anchorage",61.2181,-149.9003),
 ("Pittsburgh","PA","PGH",ET,40.4406,-79.9959),("Cincinnati","OH","CIN",ET,39.1031,-84.5120),("St. Louis","MO","STL",CT,38.6270,-90.1994),
 ("Orlando","FL","ORL",ET,28.5383,-81.3792),("Salt Lake City","UT","SLC",MT,40.7608,-111.8910),("Richmond","VA","RVA",ET,37.5407,-77.4360),
 ("Buffalo","NY","BUF",ET,42.8864,-78.8784),("Birmingham","AL","BHM",CT,33.5186,-86.8104),("Boise","ID","BOI","America/Boise",43.6150,-116.2023),
 ("Des Moines","IA","DSM",CT,41.5868,-93.6250),("Madison","WI","MSN",CT,43.0731,-89.4012),("Providence","RI","PVD",ET,41.8240,-71.4128),
 ("Hartford","CT","HFD",ET,41.7658,-72.6734),("Charleston","SC","CHS",ET,32.7765,-79.9311),("Spokane","WA","SPK",PT,47.6588,-117.4260),
 ("Little Rock","AR","LR",CT,34.7465,-92.2896),("Jackson","MS","JXN",CT,32.2988,-90.1848),("Burlington","VT","BTV",ET,44.4759,-73.2121),
 ("Portland","ME","PWM",ET,43.6591,-70.2568),("Albany","NY","ALB",ET,42.6526,-73.7562),("Reno","NV","RNO",PT,39.5296,-119.8138),
 ("Savannah","GA","SAV",ET,32.0809,-81.0912),("Knoxville","TN","KNOX",ET,35.9606,-83.9207),("Lexington","KY","LEX",ET,38.0406,-84.5037),
 ("Grand Rapids","MI","GR","America/Detroit",42.9634,-85.6681),("Santa Fe","NM","SF NM",MT,35.6870,-105.9378),("Fargo","ND","FAR",CT,46.8772,-96.7898),
 ("Sioux Falls","SD","FSD",CT,43.5446,-96.7311),("Billings","MT","BIL",MT,45.7833,-108.5007),("Cheyenne","WY","CYS",MT,41.1400,-104.8202),
 ("Wilmington","DE","WIL",ET,39.7391,-75.5398),("Newark","NJ","EWR",ET,40.7357,-74.1724),("Manchester","NH","MHT",ET,42.9956,-71.4548),
 ("Charleston","WV","CRW",ET,38.3498,-81.6326),("San Juan","PR","SJU","America/Puerto_Rico",18.4655,-66.1057),
]
WORLD = [
 ("Toronto","Canada","TOR","America/Toronto"),("Montreal","Canada","MTL","America/Toronto"),("Vancouver","Canada","VAN","America/Vancouver"),
 ("Mexico City","Mexico","CDMX","America/Mexico_City"),("London","United Kingdom","LDN","Europe/London"),("Manchester","United Kingdom","MAN","Europe/London"),
 ("Dublin","Ireland","DUB","Europe/Dublin"),("Paris","France","PAR","Europe/Paris"),("Berlin","Germany","BER","Europe/Berlin"),
 ("Madrid","Spain","MAD","Europe/Madrid"),("Barcelona","Spain","BCN","Europe/Madrid"),("Rome","Italy","ROM","Europe/Rome"),
 ("Amsterdam","Netherlands","AMS","Europe/Amsterdam"),("Stockholm","Sweden","STO","Europe/Stockholm"),("Warsaw","Poland","WAW","Europe/Warsaw"),
 ("Lisbon","Portugal","LIS","Europe/Lisbon"),("Athens","Greece","ATH","Europe/Athens"),("Istanbul","Turkey","IST","Europe/Istanbul"),
 ("Kyiv","Ukraine","KYIV","Europe/Kyiv"),("Cairo","Egypt","CAI","Africa/Cairo"),("Lagos","Nigeria","LOS","Africa/Lagos"),
 ("Nairobi","Kenya","NBO","Africa/Nairobi"),("Johannesburg","South Africa","JNB","Africa/Johannesburg"),("Dubai","United Arab Emirates","DXB","Asia/Dubai"),
 ("Mumbai","India","BOM","Asia/Kolkata"),("Delhi","India","DEL","Asia/Kolkata"),("Singapore","Singapore","SIN","Asia/Singapore"),
 ("Hong Kong","China","HK","Asia/Hong_Kong"),("Tokyo","Japan","TYO","Asia/Tokyo"),("Seoul","South Korea","SEL","Asia/Seoul"),
 ("Manila","Philippines","MNL","Asia/Manila"),("Sydney","Australia","SYD","Australia/Sydney"),("Melbourne","Australia","MEL","Australia/Melbourne"),
 ("Auckland","New Zealand","AKL","Pacific/Auckland"),("São Paulo","Brazil","SP","America/Sao_Paulo"),("Buenos Aires","Argentina","BA","America/Argentina/Buenos_Aires"),
 ("Bogotá","Colombia","BOG","America/Bogota"),("Lima","Peru","LIM","America/Lima"),
]
def slug(x):
    x = unicodedata.normalize("NFKD", x).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", x).strip("-")[:60]
def places():
    out = []
    for n, st, sh, tz, la, lo in US:
        out.append({"id": "new-york-city" if n == "New York City" else slug(n + " " + st), "name": n, "region": st, "country": "United States", "short": sh, "tz": tz, "lat": la, "lon": lo})
    for n, c, sh, tz in WORLD:
        out.append({"id": slug(n + " " + c), "name": n, "region": c, "country": c, "short": sh, "tz": tz})
    ids = [c["id"] for c in out]
    assert len(ids) == len(set(ids)), "duplicate ids"
    return out

if __name__ == "__main__":
    q = " ".join(sys.argv[1:]).lower()
    for c in places():
        if q in (c["name"] + " " + c["region"]).lower():
            print(c)
