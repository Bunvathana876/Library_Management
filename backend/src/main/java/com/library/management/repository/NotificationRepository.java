package com.library.management.repository;

import com.library.management.model.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    @Query(value = """
        SELECT n.* FROM notifications n WHERE
        n.recipient_member_id IN (SELECT id FROM members WHERE lower(email) = lower(:recipientEmail))
        OR (n.recipient_member_id IS NULL AND lower(n.recipient_email) = lower(:recipientEmail))
        ORDER BY n.created_at DESC, n.id DESC LIMIT 30
        """, nativeQuery = true)
    List<Notification> findTop30ByRecipientEmailIgnoreCaseOrderByCreatedAtDescIdDesc(String recipientEmail);

    @Query("select count(n) from Notification n where n.readAt is null and (n.recipientMemberId in (select m.id from Member m where lower(m.email) = lower(:recipientEmail)) or (n.recipientMemberId is null and lower(n.recipientEmail) = lower(:recipientEmail)))")
    long countByRecipientEmailIgnoreCaseAndReadAtIsNull(String recipientEmail);

    boolean existsByRecipientEmailIgnoreCaseAndReferenceKey(String recipientEmail, String referenceKey);

    @Query("select n from Notification n where n.id = :id and (n.recipientMemberId in (select m.id from Member m where lower(m.email) = lower(:recipientEmail)) or (n.recipientMemberId is null and lower(n.recipientEmail) = lower(:recipientEmail)))")
    Optional<Notification> findByIdAndRecipientEmailIgnoreCase(Long id, String recipientEmail);

    void deleteAllByRecipientEmailIgnoreCase(String recipientEmail);

    @Modifying
    @Query(value = """
        INSERT INTO notifications (recipient_email, recipient_member_id, type, title, message, reference_key)
        VALUES (:email, (SELECT id FROM members WHERE lower(email) = lower(:email)), :type, :title, :message, :referenceKey)
        ON CONFLICT
        DO NOTHING
        """, nativeQuery = true)
    int insertIfAbsent(@Param("email") String email, @Param("type") String type,
        @Param("title") String title, @Param("message") String message,
        @Param("referenceKey") String referenceKey);

    @Modifying
    @Query("""
        UPDATE Notification n
        SET n.readAt = :now
        WHERE n.readAt IS NULL AND (
            n.recipientMemberId IN (SELECT m.id FROM Member m WHERE LOWER(m.email) = LOWER(:email))
            OR (n.recipientMemberId IS NULL AND LOWER(n.recipientEmail) = LOWER(:email)))
        """)
    int markAllReadForRecipient(@Param("email") String email, @Param("now") Instant now);
}
