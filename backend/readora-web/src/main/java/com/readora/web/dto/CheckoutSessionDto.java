package com.readora.web.dto;

import com.readora.application.port.out.PaymentPort;

public record CheckoutSessionDto(String sessionId, String url) {
    public static CheckoutSessionDto from(PaymentPort.CheckoutSession session) {
        return new CheckoutSessionDto(session.sessionId(), session.url());
    }
}
