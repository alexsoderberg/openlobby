-- +goose Up
-- Drop lists of Named activities and the goals of each person (REQ-0030, ADR 0029 section 3). Both tables hold Blizzard
-- item IDs and our own links only, never a name, icon or answer from Blizzard (ADR 0029 C1).
-- drop_items.activity_id has no foreign key on purpose: the game write deletes and re-inserts the activities, and a
-- cascade would empty every drop list on each save. The orphan cleanup in the game write and the game delete removes the
-- entries of removed activities instead (ADR 0017 Amendment 2026-11-25).
CREATE TABLE drop_items (
    activity_id uuid    NOT NULL,
    item_id     integer NOT NULL CONSTRAINT drop_items_item_id_check CHECK (item_id >= 1),
    sort_order  integer NOT NULL,
    PRIMARY KEY (activity_id, item_id)
);
-- The icon route asks whether an item is on any drop list (ADR 0029 section 8).
CREATE INDEX drop_items_item_id_idx ON drop_items (item_id);

CREATE TABLE goals (
    user_id uuid    NOT NULL,
    game_id uuid    NOT NULL REFERENCES games (id) ON DELETE CASCADE,
    item_id integer NOT NULL CONSTRAINT goals_item_id_check CHECK (item_id >= 1),
    PRIMARY KEY (user_id, game_id, item_id)
);

-- +goose Down
-- Loses only the goals and the drop lists; games, lobbies and groups are untouched (ADR 0029 section 3).
DROP TABLE goals;
DROP TABLE drop_items;
