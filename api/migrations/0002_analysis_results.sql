CREATE TABLE analysis_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    method TEXT NOT NULL CHECK(method IN ('credit', 'direct')),
    model TEXT NOT NULL,
    credit_cost INTEGER NOT NULL DEFAULT 0,
    image_count INTEGER NOT NULL,
    item_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('completed', 'failed')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE analysis_items (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price INTEGER,
    category TEXT,
    options TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE analysis_images (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_sessions_user_id ON analysis_sessions(user_id);
CREATE INDEX idx_sessions_created_at ON analysis_sessions(created_at);
CREATE INDEX idx_items_session_id ON analysis_items(session_id);
CREATE INDEX idx_images_session_id ON analysis_images(session_id);
