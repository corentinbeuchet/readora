-- ==============================================================================
-- Flyway Database Migration V1: Core Relational Schema for Readora Platform
-- PostgreSQL 16+
-- ==============================================================================

CREATE TABLE IF NOT EXISTS works (
    id UUID PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    synopsis TEXT,
    work_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    cover_image_url VARCHAR(1024),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_works_type_status ON works (work_type, status);

CREATE TABLE IF NOT EXISTS work_genres (
    work_id UUID NOT NULL REFERENCES works (id) ON DELETE CASCADE,
    genre VARCHAR(255) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_work_genres_work_id ON work_genres (work_id);

CREATE TABLE IF NOT EXISTS chapters (
    id UUID PRIMARY KEY,
    work_id UUID NOT NULL REFERENCES works (id) ON DELETE CASCADE,
    chapter_number VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    status VARCHAR(50) NOT NULL,
    scanlation_project_id UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    published_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_chapter_work_number UNIQUE (work_id, chapter_number)
);

CREATE INDEX IF NOT EXISTS idx_chapters_work_status ON chapters (work_id, status);

CREATE TABLE IF NOT EXISTS page_assets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chapter_id UUID NOT NULL REFERENCES chapters (id) ON DELETE CASCADE,
    page_number INT NOT NULL,
    storage_key VARCHAR(1024) NOT NULL,
    cdn_url VARCHAR(1024),
    width INT DEFAULT 0,
    height INT DEFAULT 0,
    CONSTRAINT uq_chapter_page_number UNIQUE (chapter_id, page_number)
);

CREATE TABLE IF NOT EXISTS scanlation_projects (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    work_id UUID NOT NULL REFERENCES works (id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES scanlation_projects (id) ON DELETE CASCADE,
    user_id VARCHAR(100) NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_project_user UNIQUE (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS member_roles (
    member_id UUID NOT NULL REFERENCES team_members (id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_member_roles_member_id ON member_roles (member_id);

CREATE TABLE IF NOT EXISTS workflow_tasks (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES scanlation_projects (id) ON DELETE CASCADE,
    chapter_number VARCHAR(50) NOT NULL,
    stage VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    assignee_id VARCHAR(100),
    asset_package_url VARCHAR(1024),
    page_count INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_tasks_project_stage ON workflow_tasks (project_id, stage);

CREATE TABLE IF NOT EXISTS chapter_comments (
    id UUID PRIMARY KEY,
    chapter_id UUID NOT NULL REFERENCES chapters (id) ON DELETE CASCADE,
    author_id VARCHAR(100) NOT NULL,
    author_username VARCHAR(100) NOT NULL,
    content VARCHAR(2000) NOT NULL,
    page_reference INT,
    parent_id UUID REFERENCES chapter_comments (id) ON DELETE CASCADE,
    depth INT NOT NULL DEFAULT 1,
    is_spoiler BOOLEAN NOT NULL DEFAULT FALSE,
    upvotes INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_chapter_parent ON chapter_comments (chapter_id, parent_id);

CREATE TABLE IF NOT EXISTS bookmarks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    work_id UUID NOT NULL REFERENCES works (id) ON DELETE CASCADE,
    last_read_chapter_id UUID REFERENCES chapters (id) ON DELETE SET NULL,
    last_read_page_index INT NOT NULL DEFAULT 1,
    status VARCHAR(50) NOT NULL DEFAULT 'READING',
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_bookmark_user_work UNIQUE (user_id, work_id)
);
