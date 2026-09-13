package com.readora.application.port.in;

import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkId;

import java.util.List;
import java.util.Optional;

public interface BrowseCatalogUseCase {

    record Page<T>(List<T> items, int page, int size, long totalElements) {
        public int totalPages() {
            return size == 0 ? 0 : (int) Math.ceil((double) totalElements / size);
        }
    }

    Page<Work> listWorks(int page, int size);
    Optional<Work> getWork(WorkId workId);
    List<Chapter> listPublishedChapters(WorkId workId);
    Optional<ScanlationProject> getProject(ProjectId projectId);
}
