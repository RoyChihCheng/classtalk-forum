"""
End-to-end test using simulated SSO for teacher accounts 050 and 008.
Tests: SSO login, room create, topic, comment, reply, history isolation.

Usage:
    $env:COOLENG_SSO_SECRET="<secret>"; python scripts/test_full_flow.py
"""
import os
import sys
import urllib.request
import urllib.error
import urllib.parse
import http.client
import json
import hashlib
import math
import time

BASE = os.environ.get("CLASSTALK_URL", "https://classtalk-forum-287003628407.asia-east1.run.app")
SECRET = os.environ.get("COOLENG_SSO_SECRET", "")
if not SECRET:
    print("Error: set COOLENG_SSO_SECRET env var before running")
    print("  $env:COOLENG_SSO_SECRET='<secret>'; python scripts/test_full_flow.py")
    sys.exit(1)
PASS = "[PASS]"
FAIL = "[FAIL]"
results = []

def req(method, path, body=None):
    url = BASE + path
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"} if data else {}
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as res:
            text = res.read().decode()
            try: return res.status, json.loads(text)
            except: return res.status, text
    except urllib.error.HTTPError as e:
        text = e.read().decode()
        try: return e.code, json.loads(text)
        except: return e.code, text

def check(name, cond, detail=""):
    status = PASS if cond else FAIL
    results.append(cond)
    line = f"{status} {name}"
    if detail: line += f"  | {detail}"
    print(line)

def sso_callback(userid, name, role):
    """Simulate CoolEnglish SSO redirect, return (sso_uid, sso_name, sso_role) or None on failure."""
    ts = math.floor(time.time())
    raw = f"{userid}|{name}|{role}|{ts}|cool"
    p = raw.encode("utf-8").hex()
    q = hashlib.sha256((p + SECRET).encode()).hexdigest()

    conn = http.client.HTTPSConnection("classtalk-forum-287003628407.asia-east1.run.app")
    conn.request("GET", f"/auth/callback?p={p}&q={q}")
    res = conn.getresponse()
    location = res.getheader("Location", "")
    conn.close()

    if res.status != 302:
        return None, None, None

    parsed = urllib.parse.urlparse(location)
    params = urllib.parse.parse_qs(parsed.query)
    uid = params.get("sso_uid", [""])[0]
    nm  = params.get("sso_name", [""])[0]
    rl  = params.get("sso_role", [""])[0]
    return uid, nm, rl

# ─────────────────────────────────────────
print("\n" + "="*50)
print("  SSO Login Tests")
print("="*50)

uid050, name050, role050 = sso_callback("050", "測試教師050", "teacher")
check("050 SSO callback -> 302",      bool(uid050),          f"uid={uid050}")
check("050 uid correct",              uid050 == "050",       f"uid={uid050}")
check("050 role=teacher",             role050 == "teacher",  f"role={role050}")
check("050 name received",            bool(name050),         f"name={name050}")

uid008, name008, role008 = sso_callback("008", "測試教師008", "teacher")
check("008 SSO callback -> 302",      bool(uid008),          f"uid={uid008}")
check("008 uid correct",              uid008 == "008",       f"uid={uid008}")
check("008 role=teacher",             role008 == "teacher",  f"role={role008}")

uid004, name004, role004 = sso_callback("004", "測試學生004", "student")
check("004 SSO callback -> 302",      bool(uid004),          f"uid={uid004}")
check("004 role=student",             role004 == "student",  f"role={role004}")

# ─────────────────────────────────────────
print("\n" + "="*50)
print("  Teacher 050: Create Room & Topics")
print("="*50)

s, room050 = req("POST", "/api/rooms", {"name": "050的英文課討論室"})
check("050 create room -> 201",       s == 201,              f"status={s}")
check("050 room code 6 chars",        len(room050.get("code","")) == 6)
code050 = room050.get("code", "")

s, t1 = req("POST", f"/api/rooms/{code050}/topics", {"title": "Unit 1 閱讀理解", "description": "討論本週閱讀重點", "isOpen": True})
check("050 create topic -> 201",      s == 201,              f"status={s}")
tid1 = t1.get("id", "")

s, t2 = req("POST", f"/api/rooms/{code050}/topics", {"title": "Unit 2 文法練習", "isOpen": True})
check("050 create topic 2 -> 201", s == 201)
tid2 = t2.get("id", "")
# Close it via PUT (topics are always created open; toggle via PUT)
s, _ = req("PUT", f"/api/rooms/{code050}/topics/{tid2}", {"title": "Unit 2 文法練習", "isOpen": False})
check("050 close topic 2 -> 200", s == 200)

# ─────────────────────────────────────────
print("\n" + "="*50)
print("  Teacher 008: Create Room & Join 050's Room")
print("="*50)

s, room008 = req("POST", "/api/rooms", {"name": "008的課堂問答"})
check("008 create room -> 201",       s == 201,              f"status={s}")
code008 = room008.get("code", "")

# 008 joins 050's room as teacher
s, fetched = req("GET", f"/api/rooms/{code050}")
check("008 fetch 050 room -> 200",    s == 200)
check("050 room has 2 topics",        len(fetched.get("topics", [])) == 2)

# ─────────────────────────────────────────
print("\n" + "="*50)
print("  Comments: Open/Closed Topic Rules")
print("="*50)

# Teacher 050 comments on their open topic
s, c1 = req("POST", f"/api/rooms/{code050}/topics/{tid1}/comments",
    {"authorName": name050, "authorRole": "teacher", "content": "請同學仔細閱讀第一段"})
check("teacher comment on open topic -> 201", s == 201)
cid1 = c1.get("id", "")

# Student 004 comments on open topic
s, c2 = req("POST", f"/api/rooms/{code050}/topics/{tid1}/comments",
    {"authorName": name004, "authorRole": "student", "content": "老師，第三行的單字我不懂"})
check("student comment on open topic -> 201", s == 201)
cid2 = c2.get("id", "")

# Student 004 tries closed topic -> 403
s, _ = req("POST", f"/api/rooms/{code050}/topics/{tid2}/comments",
    {"authorName": name004, "authorRole": "student", "content": "我想發言"})
check("student comment on closed topic -> 403", s == 403, f"status={s}")

# Teacher 050 can comment on closed topic
s, c3 = req("POST", f"/api/rooms/{code050}/topics/{tid2}/comments",
    {"authorName": name050, "authorRole": "teacher", "content": "這個主題暫不開放"})
check("teacher comment on closed topic -> 201", s == 201)
cid3 = c3.get("id", "")

# 100-char limit
s, _ = req("POST", f"/api/rooms/{code050}/topics/{tid1}/comments",
    {"authorName": name004, "authorRole": "student", "content": "甲" * 101})
check("comment over 100 chars -> 400", s == 400)

# ─────────────────────────────────────────
print("\n" + "="*50)
print("  Replies")
print("="*50)

s, r1 = req("POST", f"/api/rooms/{code050}/topics/{tid1}/comments/{cid1}/replies",
    {"authorName": name008, "authorRole": "teacher", "content": "008老師附議，很好的問題"})
check("008 reply on 050 room -> 201", s == 201)
rid1 = r1.get("id", "")

s, r2 = req("POST", f"/api/rooms/{code050}/topics/{tid1}/comments/{cid2}/replies",
    {"authorName": name050, "authorRole": "teacher", "content": "那個單字是 'ambiguous'，表示模糊"})
check("teacher reply to student -> 201", s == 201)

# ─────────────────────────────────────────
print("\n" + "="*50)
print("  Edit Operations")
print("="*50)

s, ec = req("PUT", f"/api/rooms/{code050}/topics/{tid1}/comments/{cid2}",
    {"content": "老師，第三行的 ambiguous 是什麼意思？"})
check("edit comment -> 200",          s == 200)
check("edit content updated",         ec.get("content","").startswith("老師"))

s, er = req("PUT", f"/api/rooms/{code050}/topics/{tid1}/comments/{cid1}/replies/{rid1}",
    {"content": "008老師補充：這題考過好幾次"})
check("edit reply -> 200",            s == 200)

# ─────────────────────────────────────────
print("\n" + "="*50)
print("  Room Data Integrity")
print("="*50)

s, full = req("GET", f"/api/rooms/{code050}")
check("full room fetch -> 200",       s == 200)
topics = full.get("topics", [])
check("050 room has 2 topics",        len(topics) == 2)
open_topic = next((t for t in topics if t["id"] == tid1), None)
check("open topic has 2 comments",    open_topic and len(open_topic.get("comments", [])) == 2)
check("first comment has 1 reply",    open_topic and len(open_topic["comments"][0].get("replies", [])) >= 1)

s, room008_data = req("GET", f"/api/rooms/{code008}")
check("008 room fetch -> 200",        s == 200)
check("008 room has 0 topics",        len(room008_data.get("topics", [])) == 0)

# ─────────────────────────────────────────
print("\n" + "="*50)
print("  History Key Isolation (uid-based)")
print("="*50)
check("050 uid differs from 008 uid", uid050 != uid008, f"{uid050} vs {uid008}")
check("uid is stable account ID",
    uid050 == "050" and uid008 == "008",
    "localStorage keys: discussion_forum_history_050 / _008")

# ─────────────────────────────────────────
print("\n" + "="*50)
passed = sum(results)
total  = len(results)
print(f"Results: {passed}/{total} passed")
if passed == total:
    print("All tests passed!")
else:
    print(f"WARNING: {total - passed} test(s) failed")
print("="*50)
print(f"\nCreated rooms: {code050} (050), {code008} (008)")
print("Database has live test data - rooms remain for manual inspection.")
