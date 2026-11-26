ALTER TABLE notifications ADD COLUMN recipient_member_id BIGINT REFERENCES members(id) ON DELETE RESTRICT;
UPDATE notifications n SET recipient_member_id = m.id
FROM members m WHERE lower(trim(n.recipient_email)) = lower(trim(m.email));
CREATE INDEX idx_notifications_member_created ON notifications(recipient_member_id, created_at DESC);
CREATE UNIQUE INDEX idx_notifications_member_dedupe ON notifications(recipient_member_id, reference_key)
    WHERE recipient_member_id IS NOT NULL AND reference_key IS NOT NULL;
