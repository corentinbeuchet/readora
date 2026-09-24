package com.readora.web.dto;

import com.readora.domain.identity.Role;
import jakarta.validation.constraints.NotNull;

/// The one role an admin gives an account (US-16).
public record AssignRoleRequest(@NotNull(message = "Choose a role") Role role) {
}
