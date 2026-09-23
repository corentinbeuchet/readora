package com.readora.web.dto;

import com.readora.application.port.in.ManageTeamUseCase.MyTeam;
import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.Team;
import org.jspecify.annotations.Nullable;

import java.util.List;
import java.util.UUID;

/// A team I belong to, with my roles in it and its task boards. A board names its series (id and title) and no more:
/// `GET /teams/mine` lists every board of every team of mine.
public record MyTeamDto(UUID id, String name, @Nullable String description, List<String> myRoles, List<Board> boards) {

    public record Board(UUID projectId, SeriesRefDto work, boolean boardEnabled) {
    }

    public static MyTeamDto fromDomain(MyTeam mine, UserId me) {
        return of(mine.team(), me, mine.boards().stream().map(b -> new Board(b.projectId().value(), SeriesRefDto.fromDomain(b.work()), b.boardEnabled())).toList());
    }

    public static MyTeamDto fromDomain(Team team, UserId me) {
        return of(team, me, List.of());
    }

    private static MyTeamDto of(Team team, UserId me, List<Board> boards) {
        List<String> roles = team.findMember(me).map(member -> member.roles().stream().map(Enum::name).sorted().toList()).orElse(List.of());
        return new MyTeamDto(team.getId().value(), team.getName(), team.getDescription(), roles, boards);
    }
}
