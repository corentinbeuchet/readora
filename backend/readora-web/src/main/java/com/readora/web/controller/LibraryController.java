package com.readora.web.controller;

import com.readora.application.port.in.ManageLibraryUseCase;
import com.readora.application.port.in.NotifyUseCase;
import com.readora.domain.social.ReadingStatus;
import com.readora.domain.work.WorkId;
import com.readora.web.dto.ApiResponse;
import com.readora.web.dto.LibraryEntryDto;
import com.readora.web.dto.LibraryItemDto;
import com.readora.web.dto.SaveLibraryEntryRequest;
import com.readora.web.dto.SeriesNotificationsRequest;
import com.readora.web.security.CurrentUserProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/library")
@PreAuthorize("hasAuthority('LIBRARY_USE')")
@Tag(name = "Library", description = "My library: the series I follow and their reading status (US-05)")
public class LibraryController {

    private final ManageLibraryUseCase manageLibraryUseCase;
    private final NotifyUseCase notifyUseCase;
    private final CurrentUserProvider currentUserProvider;

    public LibraryController(ManageLibraryUseCase manageLibraryUseCase, NotifyUseCase notifyUseCase, CurrentUserProvider currentUserProvider) {
        this.manageLibraryUseCase = manageLibraryUseCase;
        this.notifyUseCase = notifyUseCase;
        this.currentUserProvider = currentUserProvider;
    }

    @GetMapping
    @Operation(summary = "List my library, optionally only one reading status")
    public ResponseEntity<ApiResponse<List<LibraryItemDto>>> list(@RequestParam(required = false) @Nullable ReadingStatus status) {
        List<LibraryItemDto> items = manageLibraryUseCase.list(currentUserProvider.requireUserId(), status).stream()
                .map(LibraryItemDto::fromDomain)
                .toList();
        return ResponseEntity.ok(ApiResponse.ok(items));
    }

    @GetMapping("/export")
    @Operation(summary = "Download my library (series, status, last chapter read) as CSV or JSON")
    public ResponseEntity<?> export(@RequestParam(defaultValue = "csv") String format) {
        var rows = manageLibraryUseCase.export(currentUserProvider.requireUserId());
        if ("json".equalsIgnoreCase(format)) {
            List<Map<String, String>> json = rows.stream().map(row -> {
                Map<String, String> item = new java.util.LinkedHashMap<>();
                item.put("title", row.title());
                item.put("status", row.status().name());
                item.put("lastChapterRead", row.lastChapterRead());
                return item;
            }).toList();
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"readora-library.json\"")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(json);
        }
        StringBuilder csv = new StringBuilder("title,status,last_chapter_read\n");
        for (var row : rows) {
            csv.append(csvCell(row.title())).append(',').append(row.status().name()).append(',')
                    .append(csvCell(row.lastChapterRead() != null ? row.lastChapterRead() : "")).append('\n');
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"readora-library.csv\"")
                .contentType(new MediaType("text", "csv", java.nio.charset.StandardCharsets.UTF_8))
                .body(csv.toString());
    }

    /// Quotes cells with separators or quotes, and neutralises spreadsheet formulas (CSV injection).
    private static String csvCell(String value) {
        String safe = !value.isEmpty() && "=+-@".indexOf(value.charAt(0)) >= 0 ? "'" + value : value;
        return safe.contains(",") || safe.contains("\"") || safe.contains("\n") ? "\"" + safe.replace("\"", "\"\"") + "\"" : safe;
    }

    @GetMapping("/{workId}")
    @Operation(summary = "Get my library entry for a series (404 when not in my library)")
    public ResponseEntity<ApiResponse<LibraryEntryDto>> get(@PathVariable UUID workId) {
        return manageLibraryUseCase.find(currentUserProvider.requireUserId(), WorkId.of(workId))
                .map(entry -> ResponseEntity.ok(ApiResponse.ok(LibraryEntryDto.fromDomain(entry))))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping("/{workId}")
    @Operation(summary = "Add a series to my library or change its reading status")
    public ResponseEntity<ApiResponse<LibraryEntryDto>> save(@PathVariable UUID workId,
                                                             @RequestBody(required = false) @Nullable SaveLibraryEntryRequest request) {
        ReadingStatus status = request != null ? request.status() : null;
        var entry = manageLibraryUseCase.save(currentUserProvider.requireUserId(), WorkId.of(workId), status);
        return ResponseEntity.ok(ApiResponse.ok(LibraryEntryDto.fromDomain(entry)));
    }

    @PutMapping("/{workId}/notifications")
    @Operation(summary = "Turn new-chapter notifications for a series in my library on or off")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> notifications(@PathVariable UUID workId,
                                                                          @RequestBody SeriesNotificationsRequest request) {
        notifyUseCase.setSeriesNotifications(currentUserProvider.requireUserId(), WorkId.of(workId), request.enabled());
        return ResponseEntity.ok(ApiResponse.ok(Map.of("enabled", request.enabled())));
    }

    @DeleteMapping("/{workId}")
    @Operation(summary = "Remove a series from my library")
    public ResponseEntity<Void> remove(@PathVariable UUID workId) {
        manageLibraryUseCase.remove(currentUserProvider.requireUserId(), WorkId.of(workId));
        return ResponseEntity.noContent().build();
    }
}
