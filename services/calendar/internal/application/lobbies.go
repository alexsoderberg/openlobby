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
	lobby, err := l.reader.Lobby(ctx, groupID, lobbyID, callerID, l.clock.Now())
	if err != nil {
		return domain.Lobby{}, nil, fmt.Errorf("get lobby: %w", err)
	}
	ids, err := l.reader.PlayerIDs(ctx, lobby.ID)
	if err != nil {
		return domain.Lobby{}, nil, fmt.Errorf("get lobby players: %w", err)
	}
	names, err := l.names.DisplayNames(ctx, ids)
	if err != nil {
		return domain.Lobby{}, nil, fmt.Errorf("look up display names: %w", err)
	}
	players := make([]domain.Player, len(ids))
	for i, id := range ids {
		players[i] = domain.Player{UserID: id, DisplayName: names[id]}
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

// Join makes a member a player of a lobby, under the group lock so that two joins cannot take the last spot together.
// The checks are in domain.JoinState.CheckJoin; a lobby missing from this group is domain.ErrLobbyNotFound.
func (l *Lobbies) Join(ctx context.Context, groupID, lobbyID, callerID string) error {
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
		add, err := state.CheckJoin(now)
		if err != nil || !add {
			return err
		}
		return tx.AddPlayer(ctx, lobbyID, callerID, now)
	})
	if err != nil {
		return fmt.Errorf("join lobby: %w", err)
	}
	return nil
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
