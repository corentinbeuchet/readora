package com.readora.application.port.in;

import com.readora.domain.common.UserId;
import com.readora.domain.identity.Subscription;

/// The reader's plan (Free or Premium). Payments were removed until a payment feature is built again: Premium is granted
/// outside the app for now (the local seed's `premium` account).
public interface ManageSubscriptionUseCase {
    Subscription getCurrent(UserId userId);
}
