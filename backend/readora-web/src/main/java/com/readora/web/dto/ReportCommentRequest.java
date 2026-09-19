package com.readora.web.dto;

import com.readora.domain.moderation.CommentReportReason;
import jakarta.validation.constraints.NotNull;

public record ReportCommentRequest(@NotNull(message = "A reason is required") CommentReportReason reason) {
}
