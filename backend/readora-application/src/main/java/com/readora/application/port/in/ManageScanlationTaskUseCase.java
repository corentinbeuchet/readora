package com.readora.application.port.in;

import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.scanlation.TaskId;
import com.readora.domain.scanlation.WorkflowTask;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.common.UserId;

public interface ManageScanlationTaskUseCase {
    WorkflowTask uploadChapterTask(ProjectId projectId, ChapterNumber chapterNumber, String assetUrl, int pageCount, UserId userId);
    WorkflowTask claimTask(ProjectId projectId, TaskId taskId, UserId userId);
    WorkflowTask submitWork(ProjectId projectId, TaskId taskId, UserId userId, String assetUrl, int pageCount);
    void publishChapterFromQC(ProjectId projectId, TaskId taskId, UserId publisherId);
}
