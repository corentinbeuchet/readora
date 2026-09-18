package com.readora.application.port.in;

import com.readora.domain.work.Chapter;
import com.readora.domain.work.PageAsset;
import com.readora.domain.common.UserId;
import com.readora.domain.work.WorkId;

import java.util.List;

public interface DirectPublishChapterUseCase {
    Chapter directPublishChapter(WorkId workId, String chapterNumber, String title, List<PageAsset> pages, UserId publisherId);
}
