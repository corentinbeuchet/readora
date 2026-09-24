package com.readora.web.controller;

import com.readora.application.port.in.ExportMyDataUseCase;
import com.readora.application.port.in.ExportMyDataUseCase.AccountExport;
import com.readora.web.security.CurrentUserProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/account")
@Tag(name = "Account", description = "What a reader does with their own account (US-15)")
public class AccountController {

    private final ExportMyDataUseCase exportMyData;
    private final CurrentUserProvider currentUserProvider;

    public AccountController(ExportMyDataUseCase exportMyData, CurrentUserProvider currentUserProvider) {
        this.exportMyData = exportMyData;
        this.currentUserProvider = currentUserProvider;
    }

    /// A downloadable file, not the API envelope: it is meant to be kept and read without Readora (GDPR portability).
    @GetMapping("/export")
    @PreAuthorize("hasAuthority('LIBRARY_USE')")
    @Operation(summary = "Download everything Readora keeps about me, as one JSON file")
    public ResponseEntity<AccountExport> export() {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"readora-account.json\"")
                .contentType(MediaType.APPLICATION_JSON)
                .body(exportMyData.export(currentUserProvider.requireUserId()));
    }
}
