package com.readora.web.dto;

import com.readora.application.port.in.CommunityUseCase.TeamPage;

import com.readora.domain.work.ChapterStatus;
import org.jspecify.annotations.Nullable;

import java.util.List;
import java.util.UUID;

public record TeamPageDto(UUID id, String name, @Nullable String description, List<Series> series, List<Member> members,
                          List<ChapterSummaryDto> latestChapters, long followers, boolean following) {

    public record Series(WorkSummaryDto work, long chapterCount) {
    }

    public record Member(String username, List<String> roles) {
    }

    public static TeamPageDto fromDomain(TeamPage page) {
        TeamRefDto team = new TeamRefDto(page.id().value(), page.name());
        return new TeamPageDto(page.id().value(), page.name(), page.description(),
                page.series().stream().map(s -> new Series(WorkSummaryDto.fromDomain(s.work()), s.chapterCount())).toList(),
                page.members().stream().map(m -> new Member(m.username(), m.roles().stream().map(Enum::name).sorted().toList())).toList(),
                page.latestChapters().stream()
                        .map(c -> new ChapterSummaryDto(c.id().value(), c.workId().value(), c.number().value(), c.title(),
                                ChapterStatus.PUBLISHED.name(), c.pageCount(), c.publishedAt(), team))
                        .toList(), page.followers(), page.following());
    }
}
