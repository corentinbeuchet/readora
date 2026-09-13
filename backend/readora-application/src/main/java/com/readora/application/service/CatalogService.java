package com.readora.application.service;

import com.readora.application.port.in.BrowseCatalogUseCase;
import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.ScanlationProjectRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkId;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

public class CatalogService implements BrowseCatalogUseCase {
    public static final int MAX_PAGE_SIZE = 100;

    private final WorkRepositoryPort workRepository;
    private final ChapterRepositoryPort chapterRepository;
    private final ScanlationProjectRepositoryPort projectRepository;

    public CatalogService(WorkRepositoryPort workRepository, ChapterRepositoryPort chapterRepository, ScanlationProjectRepositoryPort projectRepository) {
        this.workRepository = Objects.requireNonNull(workRepository, "WorkRepositoryPort cannot be null");
        this.chapterRepository = Objects.requireNonNull(chapterRepository, "ChapterRepositoryPort cannot be null");
        this.projectRepository = Objects.requireNonNull(projectRepository, "ScanlationProjectRepositoryPort cannot be null");
    }

    @Override
    public Page<Work> listWorks(int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), MAX_PAGE_SIZE);
        List<Work> items = workRepository.findAll(safePage, safeSize);
        return new Page<>(items, safePage, safeSize, workRepository.count());
    }

    @Override
    public Optional<Work> getWork(WorkId workId) {
        return workRepository.findById(workId);
    }

    @Override
    public List<Chapter> listPublishedChapters(WorkId workId) {
        return chapterRepository.findByWorkId(workId).stream()
                .filter(Chapter::isPublished)
                .toList();
    }

    @Override
    public Optional<ScanlationProject> getProject(ProjectId projectId) {
        return projectRepository.findById(projectId);
    }

    @Override
    public List<ScanlationProject> listProjectsByWork(WorkId workId) {
        return projectRepository.findByWorkId(workId);
    }
}
