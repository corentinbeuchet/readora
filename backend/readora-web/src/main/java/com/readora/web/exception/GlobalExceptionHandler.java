package com.readora.web.exception;

import com.readora.domain.common.CodedException;
import com.readora.domain.common.ErrorCodes;
import com.readora.application.exception.CommentRateLimitedException;
import com.readora.application.exception.StorageUnavailableException;
import com.readora.application.exception.PaymentProviderException;
import com.readora.application.exception.WebhookVerificationException;
import com.readora.domain.common.AccessDeniedDomainException;
import com.readora.domain.common.ConcurrentModificationDomainException;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.identity.EmailAlreadyUsedException;
import com.readora.domain.identity.InvalidCredentialsException;
import com.readora.web.dto.ApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(DomainValidationException.class)
    public ResponseEntity<ApiResponse<Void>> handleDomainValidationException(DomainValidationException ex) {
        log.warn("Domain rule violation: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(coded(ex));
    }

    @ExceptionHandler(CommentRateLimitedException.class)
    public ResponseEntity<ApiResponse<Void>> handleCommentRateLimited(CommentRateLimitedException ex) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(coded(ex));
    }

    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNotFound(NotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(coded(ex));
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNoResource(NoResourceFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error(ErrorCodes.NOT_FOUND, "Resource not found"));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
            MissingServletRequestParameterException.class, MissingServletRequestPartException.class,
            HandlerMethodValidationException.class})
    public ResponseEntity<ApiResponse<Void>> handleMalformedRequest(Exception ex) {
        // Framework messages can echo payload fragments or class names; log them, return a generic text.
        log.debug("Malformed request: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResponse.error(ErrorCodes.MALFORMED_REQUEST, "Malformed or invalid request"));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiResponse<Void>> handleMethodNotAllowed(HttpRequestMethodNotSupportedException ex) {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED).body(ApiResponse.error(ErrorCodes.METHOD_NOT_ALLOWED, "Method not allowed"));
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ApiResponse<Void>> handleUnsupportedMediaType(HttpMediaTypeNotSupportedException ex) {
        return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).body(ApiResponse.error(ErrorCodes.UNSUPPORTED_MEDIA_TYPE, "Unsupported content type"));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiResponse<Void>> handlePayloadTooLarge(MaxUploadSizeExceededException ex) {
        return ResponseEntity.status(HttpStatus.CONTENT_TOO_LARGE).body(ApiResponse.error(ErrorCodes.FILE_TOO_LARGE, "Uploaded file is too large"));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleDataIntegrity(DataIntegrityViolationException ex) {
        // Constraint names and SQL must not reach clients.
        log.warn("Data integrity violation: {}", ex.getMostSpecificCause().getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.error(ErrorCodes.CONFLICT, "The request conflicts with existing data or references something that does not exist"));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidationException(MethodArgumentNotValidException ex) {
        String errorMessage = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining(", "));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResponse.error(ErrorCodes.VALIDATION_FAILED, errorMessage));
    }

    @ExceptionHandler({InvalidCredentialsException.class, AuthenticationException.class})
    public ResponseEntity<ApiResponse<Void>> handleUnauthorized(RuntimeException ex) {
        log.debug("Authentication failure: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(coded(ex));
    }

    @ExceptionHandler({AccessDeniedDomainException.class, AccessDeniedException.class})
    public ResponseEntity<ApiResponse<Void>> handleForbidden(RuntimeException ex) {
        log.debug("Access denied: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(coded(ex));
    }

    @ExceptionHandler(ConcurrentModificationDomainException.class)
    public ResponseEntity<ApiResponse<Void>> handleConcurrentModification(ConcurrentModificationDomainException ex) {
        log.info("Optimistic lock conflict: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(coded(ex));
    }

    @ExceptionHandler(EmailAlreadyUsedException.class)
    public ResponseEntity<ApiResponse<Void>> handleConflict(EmailAlreadyUsedException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(coded(ex));
    }

    @ExceptionHandler(WebhookVerificationException.class)
    public ResponseEntity<ApiResponse<Void>> handleWebhookVerification(WebhookVerificationException ex) {
        log.warn("Rejected payment webhook: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(coded(ex));
    }

    @ExceptionHandler(StorageUnavailableException.class)
    public ResponseEntity<ApiResponse<Void>> handleStorageUnavailable(StorageUnavailableException ex) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(coded(ex));
    }

    @ExceptionHandler(PaymentProviderException.class)
    public ResponseEntity<ApiResponse<Void>> handlePaymentProvider(PaymentProviderException ex) {
        log.error("Payment provider failure: {}", ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(coded(ex));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGeneralException(Exception ex) {
        log.error("Unhandled server exception: ", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error(ErrorCodes.INTERNAL_ERROR, "Internal server error"));
    }

    /// The body for an exception: its own [ErrorCodes] code, or one for Spring Security's exceptions (thrown past the
    /// filters, e.g. by @PreAuthorize), which carry no code of ours.
    private static ApiResponse<Void> coded(RuntimeException ex) {
        String raw = ex.getMessage();
        String message = raw != null ? raw : "Request refused";
        return switch (ex) {
            case CodedException coded -> ApiResponse.error(coded.code(), message);
            case AccessDeniedException _ -> ApiResponse.error(ErrorCodes.FORBIDDEN, message);
            case AuthenticationException _ -> ApiResponse.error(ErrorCodes.UNAUTHENTICATED, message);
            default -> ApiResponse.error(ErrorCodes.INTERNAL_ERROR, message);
        };
    }
}
