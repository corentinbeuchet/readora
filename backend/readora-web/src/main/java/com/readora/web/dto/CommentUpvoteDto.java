package com.readora.web.dto;

import com.readora.application.port.in.ReaderInteractionUseCase.UpvoteOutcome;

import java.util.UUID;

public record CommentUpvoteDto(UUID commentId, int upvotes, boolean counted) {
    public static CommentUpvoteDto fromDomain(UpvoteOutcome outcome) {
        return new CommentUpvoteDto(outcome.commentId().value(), outcome.upvotes(), outcome.counted());
    }
}
