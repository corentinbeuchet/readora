package com.readora.web.dto;

import com.readora.application.port.in.ManageTeamUseCase.WaitingTask;

import java.util.UUID;

/// A task waiting for me on one of my teams' boards: the series and team it belongs to, and whether I hold it.
public record WaitingTaskDto(UUID projectId, SeriesRefDto work, TeamRefDto team, UUID taskId, String chapterNumber, String stage,
                             boolean mine) {

    public static WaitingTaskDto fromDomain(WaitingTask waiting) {
        return new WaitingTaskDto(waiting.projectId().value(), new SeriesRefDto(waiting.workId().value(), waiting.workTitle()),
                new TeamRefDto(waiting.team().getId().value(), waiting.team().getName()), waiting.taskId().value(),
                waiting.chapterNumber().value(), waiting.stage().name(), waiting.mine());
    }
}
