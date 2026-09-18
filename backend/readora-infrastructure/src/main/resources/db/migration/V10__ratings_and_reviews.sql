-- US-09: ratings (1-10) with optional reviews, and "helpful" votes on reviews.
CREATE TABLE work_ratings (
    id         UUID PRIMARY KEY,
    user_id    VARCHAR(100) NOT NULL,
    work_id    UUID         NOT NULL REFERENCES works (id) ON DELETE CASCADE,
    score      INT          NOT NULL,
    liked      VARCHAR(2000),
    disliked   VARCHAR(2000),
    verdict    VARCHAR(2000),
    rated_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_work_ratings_user_work UNIQUE (user_id, work_id),
    CONSTRAINT ck_work_ratings_score CHECK (score BETWEEN 1 AND 10)
);
CREATE INDEX idx_work_ratings_work ON work_ratings (work_id);

CREATE TABLE review_helpful_votes (
    rating_id  UUID         NOT NULL REFERENCES work_ratings (id) ON DELETE CASCADE,
    voter_id   VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (rating_id, voter_id)
);
