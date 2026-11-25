package com.library.management.dto;

import com.library.management.model.Notification;
import com.library.management.model.NotificationType;

import java.time.Instant;

public record NotificationResponse(
    Long id,
    NotificationType type,
    String title,
    String message,
    Instant readAt,
    Instant createdAt
) {
    public static NotificationResponse from(Notification n) {
        return new NotificationResponse(
            n.getId(),
            n.getType(),
            n.getTitle(),
            n.getMessage(),
            n.getReadAt(),
            n.getCreatedAt()
        );
    }
}
