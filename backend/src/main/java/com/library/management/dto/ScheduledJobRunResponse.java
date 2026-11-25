package com.library.management.dto;

public record ScheduledJobRunResponse(
    int expiredHolds,
    int dueSoonNotifications,
    int overdueNotifications
) {}
