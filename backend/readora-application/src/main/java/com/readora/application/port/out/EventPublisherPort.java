package com.readora.application.port.out;

import com.readora.domain.common.DomainEvent;

public interface EventPublisherPort {
    void publish(DomainEvent event);
}
