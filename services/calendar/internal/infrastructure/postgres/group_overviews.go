package postgres

import (
	"context"
	"database/sql"
	"time"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

const (
	// The caller's groups with the member count and the next lobby (ADR 0025 point 3a). The member count reads the prefix
	// group_id of the primary key; the lateral join probes lobbies_group_id_game_id_idx per group. A group without a
	// next lobby gets NULLs. The genre is joined from games like selectLobbiesSQL.
	selectOverviewsSQL = `SELECT g.id, g.name, (SELECT count(*) FROM group_members c WHERE c.group_id = g.id),
		n.game_name, n.mode_name, n.activity_name, n.genre, n.starts_at, n.ends_at, n.player_count, n.max_players
		FROM group_members m JOIN groups g ON g.id = m.group_id
		LEFT JOIN LATERAL (
			SELECT l.game_name, l.mode_name, l.activity_name, gm.genre, l.starts_at, l.ends_at, l.max_players,
				(SELECT count(*) FROM lobby_players p WHERE p.lobby_id = l.id) AS player_count
			FROM lobbies l LEFT JOIN games gm ON gm.id = l.game_id
			WHERE l.group_id = g.id AND l.ends_at > $2
			ORDER BY l.starts_at, l.id LIMIT 1
		) n ON true
		WHERE m.user_id = $1
		ORDER BY lower(g.name), g.id`
	// The first members of the caller's groups (ADR 0025 point 3b). A window function cannot be filtered in its own
	// WHERE, so the rank is computed in a subquery.
	selectOverviewMembersSQL = `SELECT group_id, user_id FROM (
			SELECT m.group_id, m.user_id, row_number() OVER (PARTITION BY m.group_id ORDER BY m.joined_at, m.user_id) AS rank
			FROM group_members m WHERE m.group_id IN (SELECT group_id FROM group_members WHERE user_id = $1)
		) ranked WHERE rank <= $2 ORDER BY group_id, rank`
)

var _ application.GroupOverviewReader = groupRepo{}

// Overviews returns the Group overviews of the user's groups, read with two statements in one snapshot (ADR 0025).
func (r groupRepo) Overviews(ctx context.Context, userID string, now time.Time) ([]domain.GroupOverview, error) {
	var overviews []domain.GroupOverview
	err := r.s.inSnapshot(ctx, func(tx *sql.Tx) error {
		err := eachRow(ctx, tx, func(rows *sql.Rows) error {
			overview, err := scanOverview(rows)
			overviews = append(overviews, overview)
			return err
		}, selectOverviewsSQL, userID, now)
		if err != nil {
			return err
		}
		members := map[string][]domain.Member{}
		err = eachRow(ctx, tx, func(rows *sql.Rows) error {
			var groupID string
			var member domain.Member
			err := rows.Scan(&groupID, &member.UserID)
			members[groupID] = append(members[groupID], member)
			return err
		}, selectOverviewMembersSQL, userID, domain.MaxOverviewMembers)
		for i := range overviews {
			overviews[i].Members = members[overviews[i].Group.ID]
		}
		return err
	})
	if err != nil {
		return nil, translate(err)
	}
	return overviews, nil
}

// scanOverview reads one group row. NULL lobby columns mean the group has no next lobby.
func scanOverview(rows *sql.Rows) (domain.GroupOverview, error) {
	var overview domain.GroupOverview
	var lobby domain.Lobby
	var startsAt, endsAt *time.Time
	var playerCount *int
	err := rows.Scan(&overview.Group.ID, &overview.Group.Name, &overview.MemberCount,
		&lobby.GameName, &lobby.ModeName, &lobby.ActivityName, &lobby.GameGenre, &startsAt, &endsAt, &playerCount, &lobby.MaxPlayers)
	if err != nil || startsAt == nil {
		return overview, err
	}
	lobby.StartsAt, lobby.EndsAt, lobby.PlayerCount = *startsAt, *endsAt, *playerCount
	overview.NextLobby = &lobby
	return overview, nil
}
