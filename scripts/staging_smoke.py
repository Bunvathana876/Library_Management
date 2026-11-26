#!/usr/bin/env python3
"""Create disposable fixtures and exercise ONLY the local library-phase71 staging stack.
Usage: python3 scripts/staging_smoke.py /absolute/path/to/isolated.env
Never use this fixture provisioner against development or production infrastructure.
"""
import json
import secrets
import subprocess
import sys
import urllib.request
import urllib.error
from pathlib import Path

compose = ["docker", "compose", "--env-file", sys.argv[1], "-p", "library-phase71", "-f", "compose.staging.yaml"]
base = "http://127.0.0.1:3100"

def call(method, path, data=None, token=None, expected=200):
    headers = {"Content-Type": "application/json"}
    if token: headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(base + path, data=None if data is None else json.dumps(data).encode(), headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            status, body = response.status, response.read()
    except urllib.error.HTTPError as error:
        status, body = error.code, error.read()
    assert status == expected, (method, path, status, expected)
    return json.loads(body) if body and body[:1] in (b"{", b"[") else body

def sql(statement):
    return subprocess.run(compose + ["exec", "-T", "db", "psql", "-U", "library_user", "-d", "library_db", "-v", "ON_ERROR_STOP=1", "-At"], input=statement, text=True, capture_output=True, check=True).stdout.strip()

assert call("GET", "/actuator/health")["status"] == "UP"
call("GET", "/actuator/env", expected=404)
call("GET", "/api/members", expected=401)
run = secrets.token_hex(6)
password = secrets.token_urlsafe(24)
staff_email = "staff-" + run + "@staging.example"
member_email = "reader-" + run + "@staging.example"
for email in (staff_email, member_email):
    call("POST", "/api/auth/register", {"fullName": "Staging Reader", "email": email, "password": password}, expected=201)
# Deliberate fixture-only role provisioning, confined to the named isolated stack.
sql("UPDATE app_users SET role='LIBRARIAN', token_version=md5(random()::text) WHERE email='" + staff_email + "';")
staff = call("POST", "/api/auth/login", {"email": staff_email, "password": password})["accessToken"]
member = call("POST", "/api/auth/login", {"email": member_email, "password": password})["accessToken"]
call("GET", "/api/members", token=member, expected=403)
member_id = call("GET", "/api/me/bookshelf", token=member)["memberId"]
book_data = {"title": "Staging Circulation " + run, "author": "QA", "publicationYear": 2026, "initialCopies": 2, "category": "Verification"}
book = call("POST", "/api/books", book_data, staff, 201)
book_data["title"] += " Revised"
call("PUT", "/api/books/" + str(book["id"]), book_data, staff)
assert any(b["id"] == book["id"] for b in call("GET", "/api/books?category=Verification"))
loan = call("POST", "/api/loans", {"bookId": book["id"], "memberId": member_id}, staff, 201)
call("POST", "/api/me/loans/" + str(loan["id"]) + "/renew", token=member)
sql("UPDATE loans SET borrowed_on=current_date-20, due_on=current_date-6 WHERE id=" + str(loan["id"]) + ";")
call("POST", "/api/me/loans/" + str(loan["id"]) + "/renew", token=member, expected=409)
returned = call("POST", "/api/loans/" + str(loan["id"]) + "/return", token=staff)
assert float(returned["fineAmount"]) == 3.0
paid = call("POST", "/api/loans/" + str(loan["id"]) + "/fine/pay", {"note": "Staging verification"}, staff)
assert paid["fineStatus"] == "PAID"
loan2 = call("POST", "/api/loans", {"bookId": book["id"], "memberId": member_id}, staff, 201)
sql("UPDATE loans SET borrowed_on=current_date-20, due_on=current_date-6 WHERE id=" + str(loan2["id"]) + ";")
call("POST", "/api/loans/" + str(loan2["id"]) + "/return", token=staff)
waived = call("POST", "/api/loans/" + str(loan2["id"]) + "/fine/waive", {"note": "Staging waiver verification"}, staff)
assert waived["fineStatus"] == "WAIVED"
assert call("GET", "/api/books/" + str(book["id"]))["availableCopies"] == 2
fixtures = {"staffEmail": staff_email, "memberEmail": member_email, "password": password, "bookId": book["id"], "memberId": member_id}
p = Path("/tmp/library-phase71-browser-fixtures.json")
p.touch(mode=0o600, exist_ok=True)
p.chmod(0o600)
p.write_text(json.dumps(fixtures))
print("PASS: production-profile health, proxy, registration/login, RBAC, book create/edit/filter, checkout/return, member renewal, overdue rejection, fine payment/waiver, multi-copy inventory")
