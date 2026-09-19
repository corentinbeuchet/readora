-- US-05: readers' curated lists of series, published lists can be upvoted.
CREATE TABLE reading_lists (
    id             UUID PRIMARY KEY,
    owner_id       VARCHAR(100) NOT NULL,
    owner_username VARCHAR(50)  NOT NULL,
    title          VARCHAR(100) NOT NULL,
    description    VARCHAR(500) NOT NULL,
    published      BOOLEAN      NOT NULL,
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at     TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_reading_lists_owner ON reading_lists (owner_id, updated_at);

CREATE TABLE reading_list_items (
    list_id  UUID         NOT NULL REFERENCES reading_lists (id) ON DELETE CASCADE,
    position INT          NOT NULL,
    work_id  UUID         NOT NULL REFERENCES works (id) ON DELETE CASCADE,
    note     VARCHAR(300),
    PRIMARY KEY (list_id, position)
);

CREATE TABLE reading_list_upvotes (
    list_id    UUID         NOT NULL REFERENCES reading_lists (id) ON DELETE CASCADE,
    user_id    VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (list_id, user_id)
);
