package com.readora.application.port.in;

import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.TeamCredit;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.Work;
import org.jspecify.annotations.Nullable;

import java.util.List;

public interface ReadChapterUseCase {

    /// One team's published version of a chapter number.
    record ChapterVersion(ChapterId chapterId, TeamCredit team) {
    }

    /// The chapter number before or after the one being read.
    ///
    /// @param defaultChapterId the version to open: the same team's when it has one, otherwise the first published
    /// @param versions         every version of that number, the first published first
    record Neighbour(ChapterNumber number, ChapterId defaultChapterId, List<ChapterVersion> versions) {
        public Neighbour {
            versions = List.copyOf(versions);
        }
    }

    /// A published chapter with public page URLs, its series, the team that translated it, every team's version of
    /// the same number (this one included) and the numbers before and after it (`null` at either end).
    record ChapterReading(Chapter chapter, Work work, TeamCredit team, List<ChapterVersion> versions,
                          @Nullable Neighbour previous, @Nullable Neighbour next) {
        public ChapterReading {
            versions = List.copyOf(versions);
        }
    }

    /// @throws com.readora.domain.common.NotFoundException if the chapter or its work doesn't exist
    /// @throws com.readora.domain.common.DomainValidationException `CHAPTER_NOT_PUBLISHED` for unpublished chapters
    ChapterReading readChapter(ChapterId chapterId, UserId readerId, String viewMode);
}
