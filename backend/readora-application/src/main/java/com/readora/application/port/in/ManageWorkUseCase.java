package com.readora.application.port.in;

import com.readora.domain.common.UserId;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkStatus;
import com.readora.domain.work.WorkType;

import java.util.Set;

public interface ManageWorkUseCase {
    Work createWork(String title, String synopsis, WorkType type, WorkStatus status, String coverImageUrl, Set<String> genres, UserId creatorId);
}
