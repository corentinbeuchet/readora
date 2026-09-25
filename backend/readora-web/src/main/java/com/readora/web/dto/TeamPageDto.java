package com.readora.web.dto;

import com.readora.application.port.in.CommunityUseCase.TeamMemberView;
import com.readora.application.port.in.CommunityUseCase.TeamPage;

import com.readora.domain.work.ChapterStatus;
import org.jspecify.annotations.Nullable;

import java.util.List;
import java.util.UUID;

/// A team's page. `series` is one page of its series (24, the most chapters first, `?page=`); `latestSeries` names
/// the series of `latestChapters`, which may be on another page.
public record TeamPageDto(UUID id, String name, @Nullable String description, PagedResponse<Series> series, List<Member> members,
                          List<ChapterSummaryDto> latestChapters, List<SeriesRefDto> latestSeries, long followers, boolean following) {

    public record Series(WorkSummaryDto work, long chapterCount) {
    }

    public record Member(String username, List<String> roles) {
        public static Member fromDomain(TeamMemberView member) {
            return new Member(member.username(), member.roles().stream().map(Enum::name).sorted().toList());
        }
    }

    public static TeamPageDto fromDomain(TeamPage page) {
        TeamRefDto team = new TeamRefDto(page.id().value(), page.name());
        return new TeamPageDto(page.id().value(), page.name(), page.description(),
                PagedResponse.from(page.series(), s -> new Series(WorkSummaryDto.fromDomain(s.work()), s.chapterCount())),
                page.members().stream().map(Member::fromDomain).toList(),
                page.latestChapters().stream()
                        .map(c -> new ChapterSummaryDto(c.id().value(), c.workId().value(), c.number().value(), c.title(),
                                ChapterStatus.PUBLISHED.name(), c.pageCount(), c.publishedAt(), team))
                        .toList(),
                page.latestChapters().stream().map(c -> new SeriesRefDto(c.workId().value(), c.workTitle())).distinct().toList(),
                page.followers(), page.following());
    }
}
