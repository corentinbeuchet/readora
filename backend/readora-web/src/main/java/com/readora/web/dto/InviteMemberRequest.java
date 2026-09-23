package com.readora.web.dto;

import com.readora.domain.scanlation.ScanlationRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.Set;

/// Who to invite and with which roles; the leader inviting always comes from the token.
public record InviteMemberRequest(
        @NotBlank(message = "Username cannot be blank")
        @Size(min = 3, max = 50, message = "Username must be between 3 and 50 characters")
        String username,

        @NotEmpty(message = "A team member needs at least one role")
        Set<ScanlationRole> roles
) {
}
