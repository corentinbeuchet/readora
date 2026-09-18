package com.readora.web.dto;

import com.readora.domain.report.PageReportReason;
import jakarta.validation.constraints.NotNull;

public record ReportPageRequest(@NotNull(message = "A reason is required") PageReportReason reason) {
}
