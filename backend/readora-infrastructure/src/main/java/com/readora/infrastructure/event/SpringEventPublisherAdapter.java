package com.readora.infrastructure.event;

import com.readora.application.port.out.EventPublisherPort;
import com.readora.domain.common.DomainEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

@Component
public class SpringEventPublisherAdapter implements EventPublisherPort {

    private static final Logger log = LoggerFactory.getLogger(SpringEventPublisherAdapter.class);
    private final ApplicationEventPublisher applicationEventPublisher;

    public SpringEventPublisherAdapter(ApplicationEventPublisher applicationEventPublisher) {
        this.applicationEventPublisher = applicationEventPublisher;
    }

    @Override
    public void publish(DomainEvent event) {
        log.info("Publishing domain event: {} occurred at: {}", event.getClass().getSimpleName(), event.occurredOn());
        applicationEventPublisher.publishEvent(event);
    }
}
