package com.readora.application.port.in;

import com.readora.domain.common.UserId;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.Work;
import org.jspecify.annotations.Nullable;

public interface ReadChapterUseCase {

    /// A published chapter with public page URLs, its series, and its published neighbours in reading order
    /// (`null` at either end).
    record ChapterReading(Chapter chapter, Work work, @Nullable ChapterId previousChapterId, @Nullable ChapterId nextChapterId) {
    }

    /// @throws com.readora.domain.common.NotFoundException if the chapter or its work doesn't exist
    /// @throws com.readora.domain.common.DomainValidationException `CHAPTER_NOT_PUBLISHED` for unpublished chapters
    ChapterReading readChapter(ChapterId chapterId, UserId readerId, String viewMode);
}
