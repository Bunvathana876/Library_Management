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

    List<Notification> findTop30ByRecipientEmailIgnoreCaseOrderByCreatedAtDescIdDesc(String recipientEmail);

    long countByRecipientEmailIgnoreCaseAndReadAtIsNull(String recipientEmail);

    boolean existsByRecipientEmailIgnoreCaseAndReferenceKey(String recipientEmail, String referenceKey);

    Optional<Notification> findByIdAndRecipientEmailIgnoreCase(Long id, String recipientEmail);

    void deleteAllByRecipientEmailIgnoreCase(String recipientEmail);

    @Modifying
    @Query("""
        UPDATE Notification n
        SET n.readAt = :now
        WHERE LOWER(n.recipientEmail) = LOWER(:email)
          AND n.readAt IS NULL
        """)
    int markAllReadForRecipient(@Param("email") String email, @Param("now") Instant now);
}
