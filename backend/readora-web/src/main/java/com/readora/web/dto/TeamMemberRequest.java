package com.readora.web.dto;

import com.readora.domain.scanlation.ScanlationRole;
import jakarta.validation.constraints.NotEmpty;

import java.util.Set;

/// Roles of the member named in the path; the person making the change always comes from the token.
public record TeamMemberRequest(@NotEmpty(message = "A team member needs at least one role") Set<ScanlationRole> roles) {
}
