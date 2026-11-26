-- Refuse ambiguous identities; never merge or delete existing records.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM app_users GROUP BY lower(trim(email)) HAVING count(*) > 1)
       OR EXISTS (SELECT 1 FROM members GROUP BY lower(trim(email)) HAVING count(*) > 1) THEN
        RAISE EXCEPTION 'Identity conflict: duplicate normalized emails in app_users or members. Resolve conflicts before migration.';
    END IF;
END $$;

CREATE UNIQUE INDEX app_users_normalized_email ON app_users (lower(trim(email)));
CREATE UNIQUE INDEX members_normalized_email ON members (lower(trim(email)));

ALTER TABLE members ADD COLUMN app_user_id BIGINT UNIQUE REFERENCES app_users(id);
UPDATE members m SET app_user_id = u.id
FROM app_users u WHERE lower(trim(m.email)) = lower(trim(u.email));
