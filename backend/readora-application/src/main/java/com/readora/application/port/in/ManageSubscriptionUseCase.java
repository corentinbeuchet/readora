package com.readora.application.port.in;

import com.readora.application.port.out.PaymentPort;
import com.readora.domain.identity.Subscription;
import com.readora.domain.identity.SubscriptionPlan;
import com.readora.domain.work.UserId;

public interface ManageSubscriptionUseCase {
    PaymentPort.CheckoutSession startCheckout(UserId userId, SubscriptionPlan plan, String successUrl, String cancelUrl);
    void handlePaymentEvent(PaymentPort.PaymentEvent event);
    Subscription getCurrent(UserId userId);
    Subscription cancel(UserId userId);
}
