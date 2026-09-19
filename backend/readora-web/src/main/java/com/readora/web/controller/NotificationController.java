package com.readora.web.controller;

import com.readora.application.port.in.NotifyUseCase;
import com.readora.web.dto.ApiResponse;
import com.readora.web.dto.NotificationDto;
import com.readora.web.security.CurrentUserProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/notifications")
@PreAuthorize("hasAuthority('LIBRARY_USE')")
@Tag(name = "Notifications", description = "In-app notifications (US-10)")
public class NotificationController {

    private final NotifyUseCase notifyUseCase;
    private final CurrentUserProvider currentUserProvider;

    public NotificationController(NotifyUseCase notifyUseCase, CurrentUserProvider currentUserProvider) {
        this.notifyUseCase = notifyUseCase;
        this.currentUserProvider = currentUserProvider;
    }

    @GetMapping
    @Operation(summary = "My most recent notifications")
    public ResponseEntity<ApiResponse<List<NotificationDto>>> recent() {
        return ResponseEntity.ok(ApiResponse.ok(notifyUseCase.recent(currentUserProvider.requireUserId()).stream()
                .map(NotificationDto::fromDomain).toList()));
    }

    @GetMapping("/unread-count")
    @Operation(summary = "How many notifications I haven't seen")
    public ResponseEntity<ApiResponse<Map<String, Long>>> unreadCount() {
        return ResponseEntity.ok(ApiResponse.ok(Map.of("count", notifyUseCase.unreadCount(currentUserProvider.requireUserId()))));
    }

    @PostMapping("/read-all")
    @Operation(summary = "Mark all my notifications as read")
    public ResponseEntity<ApiResponse<Map<String, Long>>> readAll() {
        notifyUseCase.markAllRead(currentUserProvider.requireUserId());
        return ResponseEntity.ok(ApiResponse.ok(Map.of("count", 0L)));
    }
}
