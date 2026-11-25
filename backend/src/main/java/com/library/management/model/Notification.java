package com.library.management.model;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "notifications")
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "recipient_email", nullable = false, length = 254)
    private String recipientEmail;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private NotificationType type;

    @Column(nullable = false, length = 160)
    private String title;

    @Column(nullable = false, length = 500)
    private String message;

    @Column(name = "reference_key", length = 120)
    private String referenceKey;

    @Column(name = "read_at")
    private Instant readAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Notification() {
        // Required by JPA
    }

    public Notification(
            String recipientEmail,
            NotificationType type,
            String title,
            String message,
            String referenceKey
    ) {
        this.recipientEmail = recipientEmail;
        this.type = type;
        this.title = title;
        this.message = message;
        this.referenceKey = referenceKey;
        this.createdAt = Instant.now();
    }

    public void markRead(Instant now) {
        if (this.readAt == null) {
            this.readAt = now != null ? now : Instant.now();
        }
    }

    public Long getId() {
        return id;
    }

    public String getRecipientEmail() {
        return recipientEmail;
    }

    public NotificationType getType() {
        return type;
    }

    public String getTitle() {
        return title;
    }

    public String getMessage() {
        return message;
    }

    public String getReferenceKey() {
        return referenceKey;
    }

    public Instant getReadAt() {
        return readAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
