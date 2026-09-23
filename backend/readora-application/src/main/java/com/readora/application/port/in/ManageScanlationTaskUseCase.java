package com.readora.application.port.in;

import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.scanlation.TaskId;
import com.readora.domain.scanlation.WorkflowTask;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.PageAsset;

import java.util.List;

public interface ManageScanlationTaskUseCase {
    /// Puts a chapter on the board with its raw pages (images already uploaded to storage).
    ///
    /// @throws com.readora.domain.common.DomainValidationException `BOARD_OFF` if the team does not use the board
    WorkflowTask uploadChapterTask(ProjectId projectId, ChapterNumber chapterNumber, List<PageAsset> rawPages, UserId userId);

    WorkflowTask claimTask(ProjectId projectId, TaskId taskId, UserId userId);

    /// The stage's work: its pages replace the task's pages and the task moves on to the next stage.
    WorkflowTask submitWork(ProjectId projectId, TaskId taskId, UserId userId, List<PageAsset> pages);

    /// Quality control approves the task and the chapter is published with the task's pages (the last stage's).
    ///
    /// @throws com.readora.domain.common.DomainValidationException `TASK_HAS_NO_PAGES` if no page was uploaded
    void publishChapterFromQC(ProjectId projectId, TaskId taskId, UserId publisherId);
}
