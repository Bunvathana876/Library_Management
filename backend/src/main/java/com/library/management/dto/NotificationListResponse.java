package com.library.management.dto;

import java.util.List;

public record NotificationListResponse(
    long unreadCount,
    List<NotificationResponse> items
) {}
