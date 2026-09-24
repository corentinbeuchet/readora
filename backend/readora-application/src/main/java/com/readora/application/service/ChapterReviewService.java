package com.readora.application.service;

import com.readora.application.port.in.ReviewChaptersUseCase;
import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.EventPublisherPort;
import com.readora.application.port.out.TeamRepositoryPort;
import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.AccessDeniedDomainException;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.Permission;
import com.readora.domain.scanlation.Team;
import com.readora.domain.scanlation.TeamCredit;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkId;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.stream.Collectors;

public class ChapterReviewService implements ReviewChaptersUseCase {

    private final ChapterRepositoryPort chapters;
    private final WorkRepositoryPort works;
    private final TeamRepositoryPort teams;
    private final UserAccountRepositoryPort users;
    private final EventPublisherPort eventPublisher;

    public ChapterReviewService(ChapterRepositoryPort chapters, WorkRepositoryPort works, TeamRepositoryPort teams,
                                UserAccountRepositoryPort users, EventPublisherPort eventPublisher) {
        this.chapters = Objects.requireNonNull(chapters, "ChapterRepositoryPort cannot be null");
        this.works = Objects.requireNonNull(works, "WorkRepositoryPort cannot be null");
        this.teams = Objects.requireNonNull(teams, "TeamRepositoryPort cannot be null");
        this.users = Objects.requireNonNull(users, "UserAccountRepositoryPort cannot be null");
        this.eventPublisher = Objects.requireNonNull(eventPublisher, "EventPublisherPort cannot be null");
    }

    @Override
    public List<WaitingChapter> waiting(UserId actorId) {
        requireModerator(actorId);
        List<Chapter> waiting = chapters.findWaitingForReview(QUEUE_LIMIT);
        Map<WorkId, String> titles = works.findAllById(waiting.stream().map(Chapter::getWorkId).distinct().toList()).stream()
                .collect(Collectors.toMap(Work::getId, Work::getTitle));
        Map<TeamId, Team> byId = teams.findAllById(waiting.stream().map(Chapter::getTeamId).distinct().toList()).stream()
                .collect(Collectors.toMap(Team::getId, Function.identity()));
        return waiting.stream()
                .filter(chapter -> titles.containsKey(chapter.getWorkId()) && byId.containsKey(chapter.getTeamId()))
                .map(chapter -> new WaitingChapter(chapter, titles.getOrDefault(chapter.getWorkId(), ""),
                        TeamCredit.of(Objects.requireNonNull(byId.get(chapter.getTeamId())))))
                .toList();
    }

    @Override
    public Chapter approve(UserId actorId, ChapterId chapterId) {
        return review(actorId, chapterId, Chapter::approve);
    }

    @Override
    public Chapter sendBack(UserId actorId, ChapterId chapterId) {
        return review(actorId, chapterId, Chapter::sendBack);
    }

    private Chapter review(UserId actorId, ChapterId chapterId, Consumer<Chapter> decision) {
        requireModerator(actorId);
        Chapter chapter = chapters.findById(chapterId).orElseThrow(() -> new NotFoundException("Chapter", chapterId));
        decision.accept(chapter);
        Chapter saved = chapters.save(chapter);
        chapter.pollDomainEvents().forEach(eventPublisher::publish);
        return saved;
    }

    private void requireModerator(UserId actorId) {
        boolean moderator = users.findById(actorId).map(account -> account.can(Permission.COMMENT_MODERATE)).orElse(false);
        if (!moderator) {
            throw new AccessDeniedDomainException("Only moderators review chapters");
        }
    }
}
