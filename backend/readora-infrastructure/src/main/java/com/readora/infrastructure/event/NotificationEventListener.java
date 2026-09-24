package com.readora.infrastructure.event;

import com.readora.application.port.in.NotifyUseCase;
import com.readora.domain.scanlation.TaskStageAdvancedEvent;
import com.readora.domain.scanlation.TeamInvitedEvent;
import com.readora.domain.social.CommentId;
import com.readora.domain.social.CommentPostedEvent;
import com.readora.domain.work.ChapterPublishedEvent;
import com.readora.domain.work.ChapterSentBackEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.support.TransactionTemplate;

/// Turns committed domain events into notifications (US-10). Runs after commit, so a rolled-back publish never
/// notifies anyone, in its own transaction (after commit, a joined transaction would never commit), and never fails
/// the action that triggered it.
@Component
public class NotificationEventListener {

    private static final Logger log = LoggerFactory.getLogger(NotificationEventListener.class);

    private final NotifyUseCase notifyUseCase;
    private final TransactionTemplate newTransaction;

    public NotificationEventListener(NotifyUseCase notifyUseCase, PlatformTransactionManager transactionManager) {
        this.notifyUseCase = notifyUseCase;
        this.newTransaction = new TransactionTemplate(transactionManager);
        this.newTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onChapterPublished(ChapterPublishedEvent event) {
        run("new chapter " + event.chapterId(), () -> notifyUseCase.notifyNewChapter(event.chapterId()));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onCommentPosted(CommentPostedEvent event) {
        CommentId parent = event.parentId();
        if (parent != null) {
            run("reply " + event.commentId(), () -> notifyUseCase.notifyReply(event.commentId()));
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onTeamInvited(TeamInvitedEvent event) {
        run("invitation " + event.invitationId(), () -> notifyUseCase.notifyInvitation(event.invitationId()));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onTaskStageAdvanced(TaskStageAdvancedEvent event) {
        run("task " + event.taskId(), () -> notifyUseCase.notifyTaskReady(event.projectId(), event.taskId(), event.stage(), event.by()));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onChapterSentBack(ChapterSentBackEvent event) {
        run("chapter sent back " + event.chapterId(), () -> notifyUseCase.notifyChapterSentBack(event.chapterId()));
    }

    private void run(String what, Runnable action) {
        try {
            newTransaction.executeWithoutResult(status -> action.run());
        } catch (RuntimeException e) {
            log.warn("Could not create notifications for {}", what, e);
        }
    }
}
