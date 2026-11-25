package com.library.management.controller;

import com.library.management.dto.NotificationListResponse;
import com.library.management.dto.NotificationResponse;
import com.library.management.service.NotificationService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/me/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public NotificationListResponse listNotifications(@AuthenticationPrincipal Jwt jwt) {
        return notificationService.getForUser(jwt.getSubject());
    }

    @PostMapping("/{id}/read")
    public NotificationResponse markRead(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt
    ) {
        return notificationService.markAsRead(id, jwt.getSubject());
    }

    @PostMapping("/read-all")
    public Map<String, Integer> markAllRead(@AuthenticationPrincipal Jwt jwt) {
        int updated = notificationService.markAllAsRead(jwt.getSubject());
        return Map.of("updated", updated);
    }
}
