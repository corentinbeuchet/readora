package com.readora.application.port.in;

import com.readora.domain.work.Chapter;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.UserId;

public interface ReadChapterUseCase {
    Chapter readChapter(ChapterId chapterId, UserId readerId, String viewMode);
}
