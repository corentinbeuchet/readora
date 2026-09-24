package com.readora.application.service;

import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.Permission;
import com.readora.domain.work.Chapter;

/// Who publishes straight away (US-11): a team's first chapter waits for a moderator, unless the publisher is one
/// (moderators and admins). Once the team has a published chapter, the next ones go out directly.
final class ChapterRelease {

    private ChapterRelease() {
    }

    static void release(Chapter chapter, UserId publisherId, ChapterRepositoryPort chapters, UserAccountRepositoryPort users) {
        boolean trusted = users.findById(publisherId).map(account -> account.can(Permission.COMMENT_MODERATE)).orElse(false);
        chapter.release(publisherId, !trusted && !chapters.hasPublishedChapter(chapter.getTeamId()));
    }
}
