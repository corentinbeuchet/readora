package com.readora.web.dto;

import com.readora.application.port.in.ManageSubscriptionUseCase.CheckoutRedirect;

public record CheckoutSessionDto(String sessionId, String url) {
    public static CheckoutSessionDto from(CheckoutRedirect session) {
        return new CheckoutSessionDto(session.sessionId(), session.url());
    }
}
