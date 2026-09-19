-- US-10: in-app notifications, and a per-series switch for new-chapter notifications.
CREATE TABLE notifications (
    id         UUID PRIMARY KEY,
    user_id    VARCHAR(100) NOT NULL,
    type       VARCHAR(30)  NOT NULL,
    message    VARCHAR(300) NOT NULL,
    link       VARCHAR(300) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    read_at    TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_notifications_user_created ON notifications (user_id, created_at);

ALTER TABLE library_entries ADD COLUMN notify BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX idx_library_entries_work_notify ON library_entries (work_id, notify);
