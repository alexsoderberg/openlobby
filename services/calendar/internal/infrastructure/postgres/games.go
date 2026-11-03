package postgres

import (
	"context"
	"errors"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

// shortcut: every lobby count is 0 until REQ-0003 creates the lobbies table. Then this query counts the lobbies of
// groupID per game_id (ADR 0010, amendment review 3) and the application orders by that count. groupID is unused until then.
const listGamesSQL = `SELECT id, name, default_max_players FROM games`

// gameRepo implements the game list port of the application layer.
type gameRepo struct{ s *Store }

var _ application.GameCatalog = gameRepo{}

// Games returns the game list repository.
func (s *Store) Games() gameRepo { return gameRepo{s} }

// ListForGroup returns every game of the list, in no particular order. A NULL default max players is returned as nil.
func (r gameRepo) ListForGroup(ctx context.Context, _ string) (usages []application.GameUsage, err error) {
	rows, err := r.s.db.QueryContext(ctx, listGamesSQL)
	if err != nil {
		return nil, translate(err)
	}
	defer func() { err = errors.Join(err, translate(rows.Close())) }()
	for rows.Next() {
		var game domain.Game
		if scanErr := rows.Scan(&game.ID, &game.Name, &game.DefaultMaxPlayers); scanErr != nil {
			return nil, translate(scanErr)
		}
		usages = append(usages, application.GameUsage{Game: game})
	}
	return usages, translate(rows.Err())
}
