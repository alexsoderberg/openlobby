package application

import (
	"context"
	"errors"
	"fmt"

	"openlobby/services/calendar/internal/domain"
)

// Lobbies holds the use cases about lobbies. Each one is given the verified caller by the transport layer.
type Lobbies struct {
	repo    LobbyRepository
	reader  LobbyReader
	catalog GameCatalog
	names   UserDirectory
	clock   Clock
}

// NewLobbies returns the lobby use cases with their ports.
func NewLobbies(repo LobbyRepository, reader LobbyReader, catalog GameCatalog, names UserDirectory, clock Clock) *Lobbies {
	return &Lobbies{repo: repo, reader: reader, catalog: catalog, names: names, clock: clock}
}

// Upcoming returns the group's lobbies that have not ended, for a member (ADR 0004 rules 2 and 8).
func (l *Lobbies) Upcoming(ctx context.Context, groupID, callerID string) ([]domain.Lobby, error) {
	if _, err := requireMember(ctx, l.reader, groupID, callerID); err != nil {
		return nil, fmt.Errorf("list lobbies: %w", err)
	}
	lobbies, err := l.reader.Upcoming(ctx, groupID, callerID, l.clock.Now())
	if err != nil {
		return nil, fmt.Errorf("list lobbies: %w", err)
	}
	return lobbies, nil
}

// Get returns an upcoming lobby of the group with its players' names, for a member. A non-member gets
// domain.ErrGroupNotFound before auth is asked; an ended or unknown lobby is domain.ErrLobbyNotFound.
func (l *Lobbies) Get(ctx context.Context, groupID, lobbyID, callerID string) (domain.Lobby, []domain.Player, error) {
	if _, err := requireMember(ctx, l.reader, groupID, callerID); err != nil {
		return domain.Lobby{}, nil, fmt.Errorf("get lobby: %w", err)
	}
	lobby, players, err := l.reader.Lobby(ctx, groupID, lobbyID, callerID, l.clock.Now())
	if err != nil {
		return domain.Lobby{}, nil, fmt.Errorf("get lobby: %w", err)
	}
	ids := make([]string, len(players))
	for i, player := range players {
		ids[i] = player.UserID
	}
	names, err := l.names.DisplayNames(ctx, ids)
	if err != nil {
		return domain.Lobby{}, nil, fmt.Errorf("look up display names: %w", err)
	}
	for i := range players {
		players[i].DisplayName = names[players[i].UserID]
	}
	return lobby, players, nil
}

// Create saves a lobby and the creator's player row in one transaction under the group lock (ADR 0004 rule 6). A
// non-member gets domain.ErrGroupNotFound before any lobby rule is checked, as the contract orders them.
func (l *Lobbies) Create(ctx context.Context, request domain.NewLobbyRequest) (domain.Lobby, error) {
	if err := l.resolveGame(ctx, &request); err != nil {
		return domain.Lobby{}, fmt.Errorf("create lobby: %w", err)
	}
	var created domain.Lobby
	err := l.repo.WithLockedGroup(ctx, request.GroupID, func(tx LobbyTx) error {
		if _, err := requireMember(ctx, tx, request.GroupID, request.CreatorID); err != nil {
			return err
		}
		lobby, err := domain.NewLobby(request, l.clock.Now())
		if err != nil {
			return err
		}
		created, err = tx.InsertLobby(ctx, lobby)
		return err
	})
	if err != nil {
		return domain.Lobby{}, fmt.Errorf("create lobby: %w", err)
	}
	return created, nil
}

// resolveGame looks up the chosen game before the lock, because the game list is not group data and the lookup must not
// hold a second connection while the lock transaction waits (ADR 0006 lock-order invariant). An unknown game is left
// nil and the domain refuses it in its place in the rule order.
func (l *Lobbies) resolveGame(ctx context.Context, request *domain.NewLobbyRequest) error {
	if request.GameID == nil {
		return nil
	}
	game, err := l.catalog.Find(ctx, *request.GameID)
	switch {
	case errors.Is(err, ErrGameNotFound):
		return nil
	case err != nil:
		return fmt.Errorf("find game: %w", err)
	}
	request.Game = &game
	return nil
}

// Delete removes a lobby and its players for the lobby's creator. The order is membership, the lobby in this group,
// then the creator (api/calendar/openapi.yaml).
func (l *Lobbies) Delete(ctx context.Context, groupID, lobbyID, callerID string) error {
	err := l.repo.WithLockedGroup(ctx, groupID, func(tx LobbyTx) error {
		if _, err := requireMember(ctx, tx, groupID, callerID); err != nil {
			return err
		}
		creatorID, found, err := tx.CreatorOf(ctx, groupID, lobbyID)
		switch {
		case err != nil:
			return err
		case !found:
			return domain.ErrLobbyNotFound
		case creatorID != callerID:
			return domain.ErrNotAllowed
		}
		return tx.DeleteLobby(ctx, groupID, lobbyID)
	})
	if err != nil {
		return fmt.Errorf("delete lobby: %w", err)
	}
	return nil
}

// Join makes a member a player of a lobby in a seat, or moves a player to another seat. It runs under the group lock, and
// the counts are read under it, so two joins cannot take the last spot or the last slot of a role together. The checks
// are in domain.JoinState.CheckJoin; a lobby missing from this group is domain.ErrLobbyNotFound.
func (l *Lobbies) Join(ctx context.Context, groupID, lobbyID, callerID string, seat domain.Seat) error {
	err := l.repo.WithLockedGroup(ctx, groupID, func(tx LobbyTx) error {
		if _, err := requireMember(ctx, tx, groupID, callerID); err != nil {
			return err
		}
		state, found, err := tx.JoinState(ctx, groupID, lobbyID, callerID)
		if err != nil {
			return err
		}
		if !found {
			return domain.ErrLobbyNotFound
		}
		now := l.clock.Now()
		save, role, err := state.CheckJoin(now, seat)
		if err != nil || !save {
			return err
		}
		return tx.SavePlayer(ctx, lobbyID, callerID, role, now)
	})
	if err != nil {
		return fmt.Errorf("join lobby: %w", err)
	}
	return nil
}

// SetGame sets the game of a lobby with no game for a player of it and returns the lobby as saved. The game is read under
// the group lock (ADR 0017 section 10); the rules are domain.LobbyFacts.CheckGameChange.
func (l *Lobbies) SetGame(ctx context.Context, groupID, lobbyID, callerID, gameID string) (domain.Lobby, error) {
	return l.changeSettings(ctx, groupID, lobbyID, callerID, func(tx LobbyTx, facts domain.LobbyFacts) error {
		game, ok, err := tx.GameOfList(ctx, gameID)
		if err != nil {
			return err
		}
		var found *domain.Game
		if ok {
			found = &game
		}
		if err := facts.CheckGameChange(l.clock.Now(), found); err != nil {
			return err
		}
		return tx.SetLobbyGame(ctx, lobbyID, game)
	})
}

// SetMode changes the mode of a lobby for a player of it and returns the lobby as saved. The mode, the caller's player
// row and the player count are read under the group lock (ADR 0017 section 10); the rules are domain.LobbyFacts.CheckModeChange.
func (l *Lobbies) SetMode(ctx context.Context, groupID, lobbyID, callerID, modeID string, currentModeID *string) (domain.Lobby, error) {
	return l.changeSettings(ctx, groupID, lobbyID, callerID, func(tx LobbyTx, facts domain.LobbyFacts) error {
		var mode *domain.GameMode
		if facts.GameID != nil { // a lobby with no game refuses every mode
			found, ok, err := tx.ModeOfGame(ctx, *facts.GameID, modeID)
			if err != nil {
				return err
			}
			if ok {
				mode = &found
			}
		}
		change, save, err := facts.CheckModeChange(l.clock.Now(), currentModeID, mode)
		if err != nil || !save {
			return err
		}
		return tx.SetLobbyMode(ctx, lobbyID, change)
	})
}

// SetActivity sets the named activity of a lobby for a player of it and returns the lobby as saved.
func (l *Lobbies) SetActivity(ctx context.Context, groupID, lobbyID, callerID, activityID string) (domain.Lobby, error) {
	return l.changeSettings(ctx, groupID, lobbyID, callerID, func(tx LobbyTx, facts domain.LobbyFacts) error {
		var activity *domain.Activity
		if facts.ModeID != nil { // a lobby with no mode refuses every activity
			found, ok, err := tx.ActivityOfMode(ctx, *facts.ModeID, activityID)
			if err != nil {
				return err
			}
			if ok {
				activity = &found
			}
		}
		if err := facts.CheckActivityChange(l.clock.Now(), activity); err != nil {
			return err
		}
		return tx.SetLobbyActivity(ctx, lobbyID, activity)
	})
}

// ClearActivity removes the named activity of a lobby for a player of it and returns the lobby. It is idempotent.
func (l *Lobbies) ClearActivity(ctx context.Context, groupID, lobbyID, callerID string) (domain.Lobby, error) {
	return l.changeSettings(ctx, groupID, lobbyID, callerID, func(tx LobbyTx, facts domain.LobbyFacts) error {
		if err := facts.CheckChange(l.clock.Now()); err != nil {
			return err
		}
		return tx.SetLobbyActivity(ctx, lobbyID, nil)
	})
}

// changeSettings runs a settings change under the group lock in the order of ADR 0017 section 10: membership, the lobby
// in this group, then apply, which reads its values and checks the rules. The answer is read in the same transaction
// after the write, so a saved change is always answered with the lobby, even if it ends or the caller leaves right
// after the commit. No player names are looked up: a lookup in auth after the commit could answer 503 to a saved
// change (Amendment 2026-11-09).
func (l *Lobbies) changeSettings(ctx context.Context, groupID, lobbyID, callerID string, apply func(LobbyTx, domain.LobbyFacts) error) (domain.Lobby, error) {
	var lobby domain.Lobby
	err := l.repo.WithLockedGroup(ctx, groupID, func(tx LobbyTx) error {
		if _, err := requireMember(ctx, tx, groupID, callerID); err != nil {
			return err
		}
		facts, found, err := tx.LobbyFacts(ctx, groupID, lobbyID, callerID)
		switch {
		case err != nil:
			return err
		case !found:
			return domain.ErrLobbyNotFound
		}
		if err := apply(tx, facts); err != nil {
			return err
		}
		lobby, err = tx.ReadLobby(ctx, groupID, lobbyID, callerID)
		return err
	})
	if err != nil {
		return domain.Lobby{}, fmt.Errorf("change lobby: %w", err)
	}
	return lobby, nil
}

// Leave removes a member from a lobby. It works at any time and for a non-player; only a missing lobby is refused.
func (l *Lobbies) Leave(ctx context.Context, groupID, lobbyID, callerID string) error {
	err := l.repo.WithLockedGroup(ctx, groupID, func(tx LobbyTx) error {
		if _, err := requireMember(ctx, tx, groupID, callerID); err != nil {
			return err
		}
		// Only the existence in this group matters here, so the creator is ignored.
		_, found, err := tx.CreatorOf(ctx, groupID, lobbyID)
		switch {
		case err != nil:
			return err
		case !found:
			return domain.ErrLobbyNotFound
		}
		return tx.RemovePlayer(ctx, lobbyID, callerID)
	})
	if err != nil {
		return fmt.Errorf("leave lobby: %w", err)
	}
	return nil
}
