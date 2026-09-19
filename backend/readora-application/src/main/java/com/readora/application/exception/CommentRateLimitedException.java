package com.readora.application.exception;

/// The author commented too recently (anti-spam, US-11). The web layer answers 429.
public class CommentRateLimitedException extends RuntimeException {
    public CommentRateLimitedException(long waitSeconds) {
        super("Please wait " + waitSeconds + " seconds before commenting again");
    }
}
