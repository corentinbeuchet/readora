package com.readora.web.controller;

import com.readora.application.port.in.ManageListsUseCase;
import com.readora.application.port.in.ManageListsUseCase.ListDraft;
import com.readora.domain.common.UserId;
import com.readora.domain.list.ListItem;
import com.readora.domain.work.WorkId;
import com.readora.web.dto.ApiResponse;
import com.readora.web.dto.ListItemRequest;
import com.readora.web.dto.ListRequest;
import com.readora.web.dto.ReadingListDto;
import com.readora.web.security.AuthenticatedUser;
import com.readora.web.security.CurrentUserProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/lists")
@Tag(name = "Lists", description = "Readers' curated lists of series (US-05)")
public class ReadingListController {

    private final ManageListsUseCase lists;
    private final CurrentUserProvider currentUserProvider;

    public ReadingListController(ManageListsUseCase lists, CurrentUserProvider currentUserProvider) {
        this.lists = lists;
        this.currentUserProvider = currentUserProvider;
    }

    @GetMapping
    @Operation(summary = "Published lists, most upvoted first")
    public ResponseEntity<ApiResponse<List<ReadingListDto>>> top() {
        return ResponseEntity.ok(ApiResponse.ok(lists.top().stream().map(ReadingListDto::fromDomain).toList()));
    }

    @GetMapping("/mine")
    @PreAuthorize("hasAuthority('LIBRARY_USE')")
    @Operation(summary = "My lists, published or not")
    public ResponseEntity<ApiResponse<List<ReadingListDto>>> mine() {
        return ResponseEntity.ok(ApiResponse.ok(lists.mine(currentUserProvider.requireUserId()).stream().map(ReadingListDto::fromDomain).toList()));
    }

    @GetMapping("/{listId}")
    @Operation(summary = "A published list, or one of my drafts")
    public ResponseEntity<ApiResponse<ReadingListDto>> get(@PathVariable UUID listId) {
        UserId viewer = currentUserProvider.current().map(AuthenticatedUser::userId).orElse(null);
        return ResponseEntity.ok(ApiResponse.ok(ReadingListDto.fromDomain(lists.get(viewer, listId))));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('LIBRARY_USE')")
    @Operation(summary = "Create a list")
    public ResponseEntity<ApiResponse<ReadingListDto>> create(@Valid @RequestBody ListRequest request) {
        AuthenticatedUser owner = currentUserProvider.require();
        var view = lists.create(owner.userId(), owner.username(), draft(request));
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(ReadingListDto.fromDomain(view)));
    }

    @PutMapping("/{listId}")
    @PreAuthorize("hasAuthority('LIBRARY_USE')")
    @Operation(summary = "Edit my list (title, description, series and notes, visibility)")
    public ResponseEntity<ApiResponse<ReadingListDto>> update(@PathVariable UUID listId, @Valid @RequestBody ListRequest request) {
        var view = lists.update(currentUserProvider.requireUserId(), listId, draft(request));
        return ResponseEntity.ok(ApiResponse.ok(ReadingListDto.fromDomain(view)));
    }

    @PostMapping("/{listId}/items")
    @PreAuthorize("hasAuthority('LIBRARY_USE')")
    @Operation(summary = "Add a series to my list (or update its note)")
    public ResponseEntity<ApiResponse<ReadingListDto>> addItem(@PathVariable UUID listId, @Valid @RequestBody ListItemRequest request) {
        var view = lists.addWork(currentUserProvider.requireUserId(), listId, WorkId.of(request.workId()), request.note());
        return ResponseEntity.ok(ApiResponse.ok(ReadingListDto.fromDomain(view)));
    }

    @PostMapping("/{listId}/upvote")
    @PreAuthorize("hasAuthority('LIBRARY_USE')")
    @Operation(summary = "Upvote someone else's published list (once)")
    public ResponseEntity<ApiResponse<Map<String, Long>>> upvote(@PathVariable UUID listId) {
        return ResponseEntity.ok(ApiResponse.ok(Map.of("upvotes", lists.upvote(currentUserProvider.requireUserId(), listId))));
    }

    private static ListDraft draft(ListRequest request) {
        List<ListItem> items = request.items() == null ? List.of()
                : request.items().stream().map(item -> new ListItem(WorkId.of(item.workId()), item.note())).toList();
        return new ListDraft(request.title(), request.description() != null ? request.description() : "", items, request.published());
    }
}
