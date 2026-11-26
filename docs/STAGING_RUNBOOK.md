# Isolated staging and recovery runbook

## Boundaries
Use `compose.staging.yaml` alone, with a unique project name and a separate secret file outside Git. Never combine it with development `compose.yaml`. No production/public deployment has been authorized. PostgreSQL and API have no published ports; frontend binds loopback only. The database network is internal. The API has outbound access for metadata providers. Production and staging use the same `production` Spring profile; test contexts use Testcontainers; development retains `local`.

## Prepare and start
Create a mode-0600 environment file outside the repository containing a unique `LIBRARY_DB_PASSWORD`, a cryptographically random 32-byte base64 `LIBRARY_JWT_SECRET_BASE64`, and `STAGING_HTTP_PORT=3100`. Generate a key using `openssl rand -base64 32`; never paste secrets into reports or commit them. A production secret manager should inject these values. Compose environment values remain readable to host Docker administrators.

```sh
docker compose --env-file /secure/staging.env -p library-staging -f compose.staging.yaml config --quiet
docker compose --env-file /secure/staging.env -p library-staging -f compose.staging.yaml up -d --build --wait
curl --fail http://127.0.0.1:3100/actuator/health
curl --fail http://127.0.0.1:3100/api/books
```

No default administrator is bootstrapped in production. Provision the initial administrator through an operator-reviewed database procedure using a freshly generated BCrypt password hash, or restore an approved existing account. Never enable the local bootstrap profile in production. Test fixture accounts are suitable only for disposable verification infrastructure.

## HTTPS and browser security
Place a trusted TLS reverse proxy in front of the loopback frontend. It must overwrite `X-Forwarded-Proto` with the actual request scheme, redirect HTTP to HTTPS, configure certificate renewal, and set HSTS after HTTPS is validated. Do not expose the inner nginx listener or API to untrusted forwarded headers. The inner proxy preserves HTTPS for Spring's forwarded-header handling. The SPA and API use the same origin, so cross-origin API access is denied by default; no wildcard CORS is introduced. Camera capture requires HTTPS or localhost and explicit browser permission. Camera permission is restricted to the same origin.

Nginx supplies nosniff, frame denial, referrer and permissions policies; fingerprinted assets cache for one year, index revalidates. Only the general health endpoint is proxied externally; internal readiness includes PostgreSQL. Swagger/OpenAPI is disabled in production. SQL/debug output is disabled; application logs go to stdout at INFO. Configure host log rotation/collection and alerting before deployment; avoid recording tokens or passwords.

## Migration preflight
V1–V9 are immutable. Verify checksums against the release and `flyway_schema_history`; startup validates them. Never use Flyway clean or edit applied scripts. Run these read-only checks against a restored/sanitized V6 copy first:

```sql
SELECT lower(trim(email)), count(*) FROM members GROUP BY 1 HAVING count(*) > 1;
SELECT lower(trim(email)), count(*) FROM app_users GROUP BY 1 HAVING count(*) > 1;
SELECT lower(trim(recipient_email)), reference_key, count(*)
FROM notifications WHERE reference_key IS NOT NULL
GROUP BY 1,2 HAVING count(*) > 1;
```

Duplicate normalized account/member identities stop V8 safely. Multiple historical notifications with the same normalized recipient/reference can stop V9's unique backfill index. Resolve ambiguous ownership with an operator-reviewed data correction on a restored copy first; do not merge/delete production records automatically. V8 intentionally permits offline members without accounts. V9 retains original recipient emails and attaches stable member ownership where matched. Old pre-V7 JWTs require login again.

## Backup and tested recovery procedure
1. Schedule an encrypted, access-controlled `pg_dump -Fc` backup before migration; retain the previous application image digest and configuration securely. Back up roles separately if needed. For continuously changing production data, use managed WAL/PITR and define RPO/RTO.
2. Use the **explicit staging project** below; replace the project only after verifying the intended environment. The command streams a dump without printing secrets:

```sh
docker compose --env-file /secure/staging.env -p library-staging -f compose.staging.yaml exec -T db pg_dump -U library_user -d library_db -Fc > /secure/backups/library-before-upgrade.dump
pg_restore --list /secure/backups/library-before-upgrade.dump
```

3. Restore into a NEW isolated PostgreSQL database/volume, never over the development database. Example inside that isolated database container: `createdb -U library_user library_restore`, then stream the dump to `pg_restore -U library_user -d library_restore --exit-on-error`.
4. Verify migration history/checksums, member/account mapping, loan/fine totals, notification count/read states, foreign keys and login/circulation smoke tests. Record restore duration. A backup is not proven recoverable until this drill succeeds.
5. On migration failure stop application writes and retain logs/backups. Prefer a forward correction migration. If rollback is required, point the previous application image at the restored pre-upgrade database only after reconciliation and approval; do not drop columns or run clean against the original database.
6. Restart with `docker compose ... restart` and `up -d --wait`; verify persistent records remain. Never use `down -v` for a retained environment.

## Release gates
Real domain/TLS, secret provisioning, administrator provisioning, SMTP delivery/retry expectations, monitoring, off-host backups/restore drill, and physical camera/device acceptance require environment/operator verification. Local isolated staging success does not constitute public deployment or production approval.
