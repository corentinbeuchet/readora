package com.readora.domain.common;

import java.io.Serializable;
import java.time.Instant;

public interface DomainEvent extends Serializable {
    Instant occurredOn();
}
