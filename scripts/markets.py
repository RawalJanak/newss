# -*- coding: utf-8 -*-
"""Build app/markets.json - a timestamped market snapshot for India, USA, China and Global.

Why a snapshot and not a live ticker: the site is static on GitHub Pages and Yahoo sends no
CORS headers, so the browser cannot fetch quotes itself. Every number here carries the time it
was taken, and the UI says so. A live feed would need a proxy server.

Data: Yahoo's v8 chart endpoint (no auth) per symbol, plus the predefined screener for US
market-wide gainers/losers/actives. India and China gainers/losers are computed from the
universes below rather than screened, because the free screener only covers US exchanges.

Run from repo root:  python scripts/markets.py
"""
import datetime
import io
import json
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

# (symbol, display name, sector)
INDIA = [
    ("RELIANCE.NS", "Reliance", "Energy"), ("TCS.NS", "TCS", "IT"),
    ("HDFCBANK.NS", "HDFC Bank", "Financials"), ("ICICIBANK.NS", "ICICI Bank", "Financials"),
    ("INFY.NS", "Infosys", "IT"), ("BHARTIARTL.NS", "Bharti Airtel", "Telecom"),
    ("SBIN.NS", "SBI", "Financials"), ("LT.NS", "Larsen & Toubro", "Industrials"),
    ("ITC.NS", "ITC", "FMCG"), ("HINDUNILVR.NS", "HUL", "FMCG"),
    ("AXISBANK.NS", "Axis Bank", "Financials"), ("KOTAKBANK.NS", "Kotak Bank", "Financials"),
    ("BAJFINANCE.NS", "Bajaj Finance", "Financials"), ("MARUTI.NS", "Maruti Suzuki", "Auto"),
    ("TATAMOTORS.NS", "Tata Motors", "Auto"), ("M&M.NS", "Mahindra & Mahindra", "Auto"),
    ("SUNPHARMA.NS", "Sun Pharma", "Pharma"), ("TITAN.NS", "Titan", "Consumer"),
    ("ULTRACEMCO.NS", "UltraTech Cement", "Materials"), ("ASIANPAINT.NS", "Asian Paints", "Materials"),
    ("WIPRO.NS", "Wipro", "IT"), ("HCLTECH.NS", "HCL Tech", "IT"),
    ("TATASTEEL.NS", "Tata Steel", "Materials"), ("JSWSTEEL.NS", "JSW Steel", "Materials"),
    ("NTPC.NS", "NTPC", "Utilities"), ("POWERGRID.NS", "Power Grid", "Utilities"),
    ("ONGC.NS", "ONGC", "Energy"), ("COALINDIA.NS", "Coal India", "Energy"),
    ("ADANIENT.NS", "Adani Enterprises", "Conglomerate"), ("ADANIPORTS.NS", "Adani Ports", "Industrials"),
    ("NESTLEIND.NS", "Nestle India", "FMCG"), ("BAJAJFINSV.NS", "Bajaj Finserv", "Financials"),
    ("TECHM.NS", "Tech Mahindra", "IT"), ("GRASIM.NS", "Grasim", "Materials"),
    ("CIPLA.NS", "Cipla", "Pharma"), ("DRREDDY.NS", "Dr Reddy's", "Pharma"),
    ("EICHERMOT.NS", "Eicher Motors", "Auto"), ("HEROMOTOCO.NS", "Hero MotoCorp", "Auto"),
    ("INDUSINDBK.NS", "IndusInd Bank", "Financials"), ("TATACONSUM.NS", "Tata Consumer", "FMCG"),
    ("BPCL.NS", "BPCL", "Energy"), ("SHRIRAMFIN.NS", "Shriram Finance", "Financials"),
    ("APOLLOHOSP.NS", "Apollo Hospitals", "Healthcare"), ("BRITANNIA.NS", "Britannia", "FMCG"),
    ("DIVISLAB.NS", "Divi's Labs", "Pharma"),
]

USA = [
    ("AAPL", "Apple", "Tech"), ("MSFT", "Microsoft", "Tech"), ("NVDA", "Nvidia", "Semis"),
    ("GOOGL", "Alphabet", "Tech"), ("AMZN", "Amazon", "Consumer"), ("META", "Meta", "Tech"),
    ("TSLA", "Tesla", "Auto"), ("AVGO", "Broadcom", "Semis"), ("JPM", "JPMorgan", "Financials"),
    ("V", "Visa", "Financials"), ("WMT", "Walmart", "Consumer"), ("XOM", "Exxon", "Energy"),
    ("UNH", "UnitedHealth", "Healthcare"), ("JNJ", "J&J", "Healthcare"), ("LLY", "Eli Lilly", "Healthcare"),
    ("MA", "Mastercard", "Financials"), ("COST", "Costco", "Consumer"), ("HD", "Home Depot", "Consumer"),
    ("PG", "P&G", "Staples"), ("AMD", "AMD", "Semis"), ("NFLX", "Netflix", "Media"),
    ("CRM", "Salesforce", "Tech"), ("BAC", "Bank of America", "Financials"), ("KO", "Coca-Cola", "Staples"),
    ("PEP", "PepsiCo", "Staples"), ("CVX", "Chevron", "Energy"), ("ORCL", "Oracle", "Tech"),
    ("INTC", "Intel", "Semis"), ("MU", "Micron", "Semis"), ("BA", "Boeing", "Industrials"),
    ("CAT", "Caterpillar", "Industrials"), ("GE", "GE Aerospace", "Industrials"),
    ("PFE", "Pfizer", "Healthcare"), ("DIS", "Disney", "Media"), ("QCOM", "Qualcomm", "Semis"),
]

CHINA = [
    ("600519.SS", "Kweichow Moutai", "Consumer"), ("601398.SS", "ICBC", "Financials"),
    ("600036.SS", "China Merchants Bank", "Financials"), ("000858.SZ", "Wuliangye", "Consumer"),
    ("300750.SZ", "CATL", "Industrials"), ("601899.SS", "Zijin Mining", "Materials"),
    ("600900.SS", "Yangtze Power", "Utilities"), ("002594.SZ", "BYD", "Auto"),
    ("601288.SS", "AgBank of China", "Financials"), ("600030.SS", "CITIC Securities", "Financials"),
    ("0700.HK", "Tencent", "Tech"), ("9988.HK", "Alibaba", "Tech"),
    ("3690.HK", "Meituan", "Tech"), ("1810.HK", "Xiaomi", "Tech"),
    ("0941.HK", "China Mobile", "Telecom"), ("1299.HK", "AIA Group", "Financials"),
    ("0388.HK", "HKEX", "Financials"), ("2318.HK", "Ping An", "Financials"),
]

INDICES = {
    "india":  [("^NSEI", "NIFTY 50"), ("^BSESN", "SENSEX"), ("^NSEBANK", "BANK NIFTY"), ("USDINR=X", "USD/INR")],
    "usa":    [("^GSPC", "S&P 500"), ("^IXIC", "NASDAQ"), ("^DJI", "DOW"), ("^VIX", "VIX")],
    "china":  [("000001.SS", "SSE COMPOSITE"), ("^HSI", "HANG SENG"), ("399001.SZ", "SHENZHEN"), ("CNY=X", "USD/CNY")],
    "global": [("^FTSE", "FTSE 100"), ("^GDAXI", "DAX"), ("^N225", "NIKKEI 225"), ("^FCHI", "CAC 40")],
}

GLOBAL_BOARD = [
    ("BZ=F", "Brent Crude", "Energy"), ("CL=F", "WTI Crude", "Energy"),
    ("GC=F", "Gold", "Metals"), ("SI=F", "Silver", "Metals"),
    ("DX-Y.NYB", "Dollar Index", "FX"), ("USDINR=X", "USD/INR", "FX"),
    ("^TNX", "US 10Y Yield", "Rates"), ("BTC-USD", "Bitcoin", "Crypto"),
    ("^N225", "Nikkei 225", "Equity"), ("^FTSE", "FTSE 100", "Equity"),
    ("^GDAXI", "DAX", "Equity"), ("^HSI", "Hang Seng", "Equity"),
]

RECENT = {
    "india": [("SWIGGY.NS", "Swiggy", "2024"), ("OLAELEC.NS", "Ola Electric", "2024"),
              ("HYUNDAI.NS", "Hyundai Motor India", "2024"), ("LENSKART.NS", "Lenskart", "2025"),
              ("FIRSTCRY.NS", "FirstCry", "2024"), ("AWFIS.NS", "Awfis", "2024"),
              ("IXIGO.NS", "ixigo", "2024"), ("NTPCGREEN.NS", "NTPC Green", "2024"),
              ("WAAREEENER.NS", "Waaree Energies", "2024"), ("PREMIERENE.NS", "Premier Energies", "2024"),
              ("BAJAJHFL.NS", "Bajaj Housing Finance", "2024"), ("SAGILITY.NS", "Sagility", "2024")],
    "usa":   [("RDDT", "Reddit", "2024"), ("ARM", "Arm Holdings", "2023"),
              ("CART", "Instacart", "2023"), ("BIRK", "Birkenstock", "2023"),
              ("CRCL", "Circle", "2025"), ("TEM", "Tempus AI", "2024"),
              ("ALAB", "Astera Labs", "2024"), ("LINE", "Lineage", "2024"),
              ("KVYO", "Klaviyo", "2023"), ("SAIL", "SailPoint", "2025")],
    "china": [("2015.HK", "Li Auto", "2021"), ("9868.HK", "XPeng", "2021"),
              ("9866.HK", "NIO", "2022"), ("6690.HK", "Haier Smart Home", "2020")],
}


def fetch(sym):
    try:
        req = urllib.request.Request(
            "https://query1.finance.yahoo.com/v8/finance/chart/%s?interval=1d&range=5d"
            % urllib.parse.quote(sym), headers=UA)
        with urllib.request.urlopen(req, timeout=25) as r:
            d = json.loads(r.read().decode("utf-8", "ignore"))
        res = d["chart"]["result"][0]
        m = res["meta"]
        px = m.get("regularMarketPrice")
        prev = m.get("chartPreviousClose") or m.get("previousClose")
        if px is None or not prev:
            return None
        vol = m.get("regularMarketVolume")
        if not vol:
            try:
                v = [x for x in res["indicators"]["quote"][0]["volume"] if x]
                vol = v[-1] if v else 0
            except Exception:
                vol = 0
        return {"symbol": sym, "price": round(px, 2), "prev": round(prev, 2),
                "change_pct": round((px - prev) / prev * 100, 2),
                "currency": m.get("currency"), "volume": vol or 0,
                "turnover": (vol or 0) * px}
    except Exception:
        return None


def bulk(symbols):
    out = {}
    with ThreadPoolExecutor(max_workers=12) as pool:
        for r in pool.map(fetch, symbols):
            if r:
                out[r["symbol"]] = r
    return out


def rows(universe, quotes):
    out = []
    for sym, name, sector in universe:
        q = quotes.get(sym)
        if q:
            out.append({"symbol": sym.split(".")[0].replace("^", ""), "name": name,
                        "sector": sector, "price": q["price"], "change_pct": q["change_pct"],
                        "currency": q["currency"], "turnover": q["turnover"]})
    return out


def screener(scr, count=8):
    try:
        req = urllib.request.Request(
            "https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved"
            "?scrIds=%s&count=%d" % (scr, count), headers=UA)
        with urllib.request.urlopen(req, timeout=25) as r:
            d = json.loads(r.read().decode("utf-8", "ignore"))
        out = []
        for q in d["finance"]["result"][0].get("quotes", []):
            if q.get("regularMarketPrice") is None:
                continue
            out.append({"symbol": q.get("symbol"), "name": (q.get("shortName") or "")[:34],
                        "sector": "", "price": round(q["regularMarketPrice"], 2),
                        "change_pct": round(q.get("regularMarketChangePercent") or 0, 2),
                        "currency": q.get("currency", "USD"),
                        "turnover": (q.get("regularMarketVolume") or 0) * q["regularMarketPrice"]})
        return out
    except Exception:
        return []


def sector_view(items, min_n=2):
    """Average move per sector.

    Sectors with a single stock are dropped: one company is not a sector, and letting
    Bharti Airtel stand in for 'Telecom' produced a leader board where the best sector
    was one stock having a good day.
    """
    agg = {}
    for it in items:
        if not it["sector"]:
            continue
        agg.setdefault(it["sector"], []).append(it["change_pct"])
    avg = [{"sector": k, "avg": round(sum(v) / len(v), 2), "n": len(v)}
           for k, v in agg.items() if len(v) >= min_n]
    avg.sort(key=lambda x: -x["avg"])
    return avg


def build_market(key, universe, index_syms, recent_list):
    syms = [s for s, _, _ in universe] + [s for s, _ in index_syms] + \
           [s for s, _, _ in (recent_list or [])]
    q = bulk(list(dict.fromkeys(syms)))

    items = rows(universe, q)
    idx = [{"symbol": nm, "price": q[s]["price"], "change_pct": q[s]["change_pct"],
            "currency": q[s]["currency"]} for s, nm in index_syms if s in q]

    up = sum(1 for i in items if i["change_pct"] > 0)
    down = sum(1 for i in items if i["change_pct"] < 0)
    sectors = sector_view(items)

    by_chg = sorted(items, key=lambda x: -x["change_pct"])
    gainers = [i for i in by_chg if i["change_pct"] > 0][:8]
    losers = [i for i in reversed(by_chg) if i["change_pct"] < 0][:8]
    actives = sorted(items, key=lambda x: -x["turnover"])[:8]

    if key == "usa":
        g, l, a = screener("day_gainers"), screener("day_losers"), screener("most_actives")
        gainers, losers, actives = g or gainers, l or losers, a or actives

    recent = []
    for sym, name, yr in (recent_list or []):
        if sym in q:
            recent.append({"symbol": sym.split(".")[0], "name": name, "sector": "Listed " + yr,
                           "price": q[sym]["price"], "change_pct": q[sym]["change_pct"],
                           "currency": q[sym]["currency"], "turnover": q[sym]["turnover"]})
    recent.sort(key=lambda x: -x["change_pct"])

    return {"indices": idx, "breadth": {"up": up, "down": down, "total": len(items)},
            "sectors": sectors, "gainers": gainers, "losers": losers,
            "actives": actives, "recent": recent}


def main():
    out = {}
    out["india"] = build_market("india", INDIA, INDICES["india"], RECENT["india"])
    out["usa"] = build_market("usa", USA, INDICES["usa"], RECENT["usa"])
    out["china"] = build_market("china", CHINA, INDICES["china"], RECENT["china"])

    gq = bulk([s for s, _, _ in GLOBAL_BOARD] + [s for s, _ in INDICES["global"]])
    board = rows(GLOBAL_BOARD, gq)
    out["global"] = {
        "indices": [{"symbol": nm, "price": gq[s]["price"], "change_pct": gq[s]["change_pct"],
                     "currency": gq[s]["currency"]} for s, nm in INDICES["global"] if s in gq],
        "breadth": {"up": sum(1 for i in board if i["change_pct"] > 0),
                    "down": sum(1 for i in board if i["change_pct"] < 0), "total": len(board)},
        "sectors": sector_view(board),
        "gainers": sorted([i for i in board if i["change_pct"] > 0], key=lambda x: -x["change_pct"])[:8],
        "losers": sorted([i for i in board if i["change_pct"] < 0], key=lambda x: x["change_pct"])[:8],
        "actives": board, "recent": [],
    }

    now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=5, minutes=30)))
    doc = {"generated_at": now.isoformat(), "markets": out}
    json.dump(doc, io.open("app/markets.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    print("WROTE app/markets.json @", doc["generated_at"])
    for k, v in out.items():
        b = v["breadth"]
        top = v["sectors"][0]["sector"] if v["sectors"] else "-"
        bot = v["sectors"][-1]["sector"] if v["sectors"] else "-"
        print("  %-7s idx=%d breadth %d up / %d down of %d | lead %s | lag %s | g%d l%d a%d new%d"
              % (k, len(v["indices"]), b["up"], b["down"], b["total"], top, bot,
                 len(v["gainers"]), len(v["losers"]), len(v["actives"]), len(v["recent"])))


if __name__ == "__main__":
    main()
