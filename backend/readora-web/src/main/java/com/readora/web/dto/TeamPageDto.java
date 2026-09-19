package com.readora.web.dto;

import com.readora.application.port.in.CommunityUseCase.TeamPage;

import java.util.List;
import java.util.UUID;

public record TeamPageDto(UUID id, String name, WorkSummaryDto series, List<Member> members, List<ChapterSummaryDto> latestChapters,
                          long followers, boolean following) {

    public record Member(String username, List<String> roles) {
    }

    public static TeamPageDto fromDomain(TeamPage page) {
        return new TeamPageDto(page.id().value(), page.name(), WorkSummaryDto.fromDomain(page.series()),
                page.members().stream().map(m -> new Member(m.username(), m.roles().stream().map(Enum::name).sorted().toList())).toList(),
                page.latestChapters().stream().map(ChapterSummaryDto::fromDomain).toList(), page.followers(), page.following());
    }
}
