"""
Clear all classtalk-forum data (rooms/topics/comments/replies only)
Does NOT touch other tables.
Usage: python scripts/clear_db.py <SUPABASE_URL> <SUPABASE_KEY>
"""
import sys
import urllib.request
import urllib.error

def api(base, key, method, table, filter_str):
    url = f"{base}/rest/v1/{table}?{filter_str}"
    req = urllib.request.Request(url, method=method, headers={
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Prefer": "return=minimal"
    })
    try:
        with urllib.request.urlopen(req) as res:
            return res.status, ""
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

def count(base, key, table):
    url = f"{base}/rest/v1/{table}?select=id"
    req = urllib.request.Request(url, headers={
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Prefer": "count=exact",
        "Range": "0-0"
    })
    try:
        with urllib.request.urlopen(req) as res:
            cr = res.getheader("Content-Range", "*/0")
            return cr.split("/")[-1]
    except urllib.error.HTTPError as e:
        cr = e.headers.get("Content-Range", "*/0")
        return cr.split("/")[-1]

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python scripts/clear_db.py <SUPABASE_URL> <SUPABASE_KEY>")
        sys.exit(1)

    base = sys.argv[1].rstrip("/")
    key = sys.argv[2]

    # Delete in FK order: children first
    TABLES = ["replies", "comments", "topics", "rooms"]

    print("=== Before ===")
    for t in TABLES:
        print(f"  {t}: {count(base, key, t)}")

    print("\nClearing...")
    all_ok = True
    for t in TABLES:
        # created_at > epoch matches all rows; required by Supabase (no filter = rejected)
        status, msg = api(base, key, "DELETE", t, "created_at=gt.1970-01-01T00:00:00")
        if status in (200, 204):
            print(f"  [OK] {t} cleared")
        else:
            print(f"  [FAIL] {t} HTTP {status}: {msg}")
            all_ok = False

    print("\n=== After ===")
    for t in TABLES:
        print(f"  {t}: {count(base, key, t)}")

    print("\nDone!" if all_ok else "\nCompleted with errors above.")
