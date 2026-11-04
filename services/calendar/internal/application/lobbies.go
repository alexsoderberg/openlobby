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
	catalog GameCatalog
	clock   Clock
}

// NewLobbies returns the lobby use cases with their ports.
func NewLobbies(repo LobbyRepository, catalog GameCatalog, clock Clock) *Lobbies {
	return &Lobbies{repo: repo, catalog: catalog, clock: clock}
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
