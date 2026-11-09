package application_test

import (
	"bytes"
	"context"
	"errors"
	"io"
	"log/slog"
	"strings"
	"testing"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

const gameID = "ce3ff9c1-dabb-4270-b5e0-7b34de37410b"

var (
	admin     = domain.Actor{UserID: aliceID, IsSystemAdmin: true}
	nonAdmin  = domain.Actor{UserID: bobID}
	fiveMax   = intPtr(5)
	chessName = "Chess"
)

// fakeEditor keeps the game list in memory and applies the rules of the adapter: a name is taken when another game has
// it ignoring case, and an unknown ID is not found. It counts the calls, so a test can show that nothing was written.
type fakeEditor struct {
	games []domain.Game
	calls int
	err   error
}

func (f *fakeEditor) Create(_ context.Context, game domain.Game) (domain.Game, error) {
	f.calls++
	if f.err != nil {
		return domain.Game{}, f.err
	}
	if f.taken(game.Name, "") {
		return domain.Game{}, application.ErrGameTaken
	}
	game.ID = newID
	f.games = append(f.games, game)
	return game, nil
}

func (f *fakeEditor) Replace(_ context.Context, game domain.Game) (domain.Game, error) {
	f.calls++
	index := f.indexOf(game.ID)
	switch {
	case f.err != nil:
		return domain.Game{}, f.err
	case index < 0:
		return domain.Game{}, application.ErrGameNotFound
	case f.taken(game.Name, game.ID):
		return domain.Game{}, application.ErrGameTaken
	}
	f.games[index] = game
	return game, nil
}

func (f *fakeEditor) Delete(_ context.Context, id string) error {
	f.calls++
	index := f.indexOf(id)
	switch {
	case f.err != nil:
		return f.err
	case index < 0:
		return application.ErrGameNotFound
	}
	f.games = append(f.games[:index], f.games[index+1:]...)
	return nil
}

func (f *fakeEditor) indexOf(id string) int {
	for i, game := range f.games {
		if game.ID == id {
			return i
		}
	}
	return -1
}

func (f *fakeEditor) taken(name, exceptID string) bool {
	for _, game := range f.games {
		if game.ID != exceptID && strings.EqualFold(game.Name, name) {
			return true
		}
	}
	return false
}

func newAdminGames(catalog *fakeCatalog, editor *fakeEditor) *application.Games {
	return application.NewGames(&fakeStore{}, catalog, editor, discardLog())
}

// Only a system admin gets the list. Other callers are refused before the catalog is read (ADR 0011).
func TestListGamesGivesTheListToSystemAdminOnly(t *testing.T) {
	catalog := &fakeCatalog{listed: []domain.Game{{ID: gameID, Name: "Overwatch", DefaultMaxPlayers: fiveMax}}}
	games := newAdminGames(catalog, &fakeEditor{})

	got, err := games.ListGames(context.Background(), admin)

	if err != nil || len(got) != 1 || got[0].ID != gameID {
		t.Fatalf("list %+v, error %v; want the catalog's games", got, err)
	}
	_, err = games.ListGames(context.Background(), nonAdmin)
	if !errors.Is(err, domain.ErrNotAllowed) {
		t.Fatalf("non-admin error %v, want ErrNotAllowed", err)
	}
	if catalog.listCalls != 1 {
		t.Fatalf("catalog read %d times, want once (the non-admin read must not happen)", catalog.listCalls)
	}
}

func TestListGamesKeepsUnavailable(t *testing.T) {
	games := newAdminGames(&fakeCatalog{listErr: domain.ErrUnavailable}, &fakeEditor{})

	_, err := games.ListGames(context.Background(), admin)

	if !errors.Is(err, domain.ErrUnavailable) {
		t.Fatalf("error %v, want ErrUnavailable", err)
	}
}

func TestCreateGameAddsTrimmedGameForSystemAdmin(t *testing.T) {
	editor := &fakeEditor{}

	created, err := newAdminGames(&fakeCatalog{}, editor).CreateGame(context.Background(), admin, "  Chess  ", fiveMax, nil, nil, nil)

	if err != nil || created.ID != newID || created.Name != chessName || *created.DefaultMaxPlayers != 5 {
		t.Fatalf("created %+v, error %v; want the generated ID and the trimmed name", created, err)
	}
}

func TestCreateGameAllowsOmittedDefaultMax(t *testing.T) {
	editor := &fakeEditor{}

	created, err := newAdminGames(&fakeCatalog{}, editor).CreateGame(context.Background(), admin, chessName, nil, nil, nil, nil)

	if err != nil || created.DefaultMaxPlayers != nil {
		t.Fatalf("created %+v, error %v; want no default max", created, err)
	}
}

// The admin check comes before validation and before any write, so a non-admin learns nothing about the rules.
func TestCreateGameRefusesNonAdminBeforeValidationAndWrite(t *testing.T) {
	editor := &fakeEditor{}

	_, err := newAdminGames(&fakeCatalog{}, editor).CreateGame(context.Background(), nonAdmin, "", intPtr(0), nil, nil, nil)

	if !errors.Is(err, domain.ErrNotAllowed) {
		t.Fatalf("error %v, want ErrNotAllowed", err)
	}
	if editor.calls != 0 {
		t.Fatalf("editor called %d times for a non-admin", editor.calls)
	}
}

func TestCreateGameRefusesInvalidInputAndSavesNothing(t *testing.T) {
	tests := []struct {
		name    string
		raw     string
		max     *int
		wantErr error
	}{
		{name: "empty name", raw: "", wantErr: domain.ErrInvalidGame},
		{name: "reserved name", raw: "other", wantErr: domain.ErrInvalidGame},
		{name: "zero max", raw: chessName, max: intPtr(0), wantErr: domain.ErrInvalidCapacity},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			editor := &fakeEditor{}

			_, err := newAdminGames(&fakeCatalog{}, editor).CreateGame(context.Background(), admin, tc.raw, tc.max, nil, nil, nil)

			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("error %v, want %v", err, tc.wantErr)
			}
			if editor.calls != 0 {
				t.Fatalf("editor called %d times for invalid input", editor.calls)
			}
		})
	}
}

func TestCreateGameReportsTakenNameIgnoringCase(t *testing.T) {
	editor := &fakeEditor{games: []domain.Game{{ID: gameID, Name: "Overwatch"}}}

	_, err := newAdminGames(&fakeCatalog{}, editor).CreateGame(context.Background(), admin, "OVERWATCH", nil, nil, nil, nil)

	if !errors.Is(err, application.ErrGameTaken) {
		t.Fatalf("error %v, want ErrGameTaken", err)
	}
}

func TestCreateGameKeepsUnavailable(t *testing.T) {
	_, err := newAdminGames(&fakeCatalog{}, &fakeEditor{err: domain.ErrUnavailable}).CreateGame(context.Background(), admin, chessName, nil, nil, nil, nil)

	if !errors.Is(err, domain.ErrUnavailable) {
		t.Fatalf("error %v, want ErrUnavailable", err)
	}
}

// The admin check comes before the reserved-name check, and an unknown ID is found only after the name is valid.
func TestReplaceGameOrdersChecksAsTheContractDoes(t *testing.T) {
	tests := []struct {
		name    string
		actor   domain.Actor
		raw     string
		editor  *fakeEditor
		wantErr error
	}{
		{name: "non-admin with reserved name", actor: nonAdmin, raw: "Other", wantErr: domain.ErrNotAllowed},
		{name: "reserved name on an unknown ID", actor: admin, raw: "Other", wantErr: domain.ErrInvalidGame},
		{name: "unknown ID", actor: admin, raw: chessName, wantErr: application.ErrGameNotFound},
		{
			name:    "name used by another game",
			actor:   admin,
			raw:     "overwatch",
			editor:  &fakeEditor{games: []domain.Game{{ID: gameID, Name: chessName}, {ID: newID, Name: "Overwatch"}}},
			wantErr: application.ErrGameTaken,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			editor := tc.editor
			if editor == nil {
				editor = &fakeEditor{}
			}

			_, err := newAdminGames(&fakeCatalog{}, editor).ReplaceGame(context.Background(), tc.actor, gameID, tc.raw, nil, nil, nil, nil)

			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("error %v, want %v", err, tc.wantErr)
			}
		})
	}
}

func TestReplaceGameKeepsIDAndAllowsKeepingOwnName(t *testing.T) {
	editor := &fakeEditor{games: []domain.Game{{ID: gameID, Name: chessName, DefaultMaxPlayers: fiveMax}}}

	replaced, err := newAdminGames(&fakeCatalog{}, editor).ReplaceGame(context.Background(), admin, gameID, "chess", nil, nil, nil, nil)

	if err != nil || replaced.ID != gameID || replaced.DefaultMaxPlayers != nil {
		t.Fatalf("replaced %+v, error %v; want the same ID and no default max", replaced, err)
	}
}

func TestDeleteGameRemovesTheGameForSystemAdmin(t *testing.T) {
	editor := &fakeEditor{games: []domain.Game{{ID: gameID, Name: chessName}}}

	err := newAdminGames(&fakeCatalog{}, editor).DeleteGame(context.Background(), admin, gameID)

	if err != nil || len(editor.games) != 0 {
		t.Fatalf("error %v, games left %+v; want the game removed", err, editor.games)
	}
}

func TestDeleteGameRefusesNonAdminAndUnknownGame(t *testing.T) {
	editor := &fakeEditor{games: []domain.Game{{ID: gameID, Name: chessName}}}
	games := newAdminGames(&fakeCatalog{}, editor)

	if err := games.DeleteGame(context.Background(), nonAdmin, gameID); !errors.Is(err, domain.ErrNotAllowed) {
		t.Fatalf("non-admin error %v, want ErrNotAllowed", err)
	}
	if err := games.DeleteGame(context.Background(), admin, newID); !errors.Is(err, application.ErrGameNotFound) {
		t.Fatalf("unknown game error %v, want ErrGameNotFound", err)
	}
	if len(editor.games) != 1 {
		t.Fatalf("game list changed by a refused delete: %+v", editor.games)
	}
}

func discardLog() *slog.Logger { return slog.New(slog.NewTextHandler(io.Discard, nil)) }

// Every successful write is logged with the actor and the game, so the list changes can be traced (ADR 0010).
func TestWritesAreLoggedWithActorAndGame(t *testing.T) {
	var logged bytes.Buffer
	games := application.NewGames(&fakeStore{}, &fakeCatalog{}, &fakeEditor{}, slog.New(slog.NewTextHandler(&logged, nil)))

	if _, err := games.CreateGame(context.Background(), admin, chessName, nil, nil, nil, nil); err != nil {
		t.Fatal(err)
	}

	line := logged.String()
	if !strings.Contains(line, "action=create") || !strings.Contains(line, "actorUserId="+aliceID) || !strings.Contains(line, "gameId="+newID) {
		t.Fatalf("log %q, want the action, the actor and the game", line)
	}
}

// Replace and delete are logged like create (ADR 0010).
func TestReplaceAndDeleteAreLogged(t *testing.T) {
	var logged bytes.Buffer
	editor := &fakeEditor{games: []domain.Game{{ID: gameID, Name: "Old"}}}
	games := application.NewGames(&fakeStore{}, &fakeCatalog{}, editor, slog.New(slog.NewTextHandler(&logged, nil)))

	if _, err := games.ReplaceGame(context.Background(), admin, gameID, chessName, nil, nil, nil, nil); err != nil {
		t.Fatal(err)
	}
	if err := games.DeleteGame(context.Background(), admin, gameID); err != nil {
		t.Fatal(err)
	}

	for _, action := range []string{"action=replace", "action=delete"} {
		if !strings.Contains(logged.String(), action) || !strings.Contains(logged.String(), "gameId="+gameID) {
			t.Fatalf("log %q, want %s with the game", logged.String(), action)
		}
	}
}

// The admin check comes before the genre check, and the genre check before any write (ADR 0016).
func TestGameWritesCheckPermissionBeforeGenreAndGenreBeforeWrite(t *testing.T) {
	bad := domain.Genre("puzzle")
	editor := &fakeEditor{games: []domain.Game{{ID: gameID, Name: chessName}}}
	games := newAdminGames(&fakeCatalog{}, editor)

	_, createErr := games.CreateGame(context.Background(), nonAdmin, chessName, nil, &bad, nil, nil)
	_, replaceErr := games.ReplaceGame(context.Background(), nonAdmin, gameID, chessName, nil, &bad, nil, nil)
	if !errors.Is(createErr, domain.ErrNotAllowed) || !errors.Is(replaceErr, domain.ErrNotAllowed) {
		t.Fatalf("errors %v and %v, want ErrNotAllowed", createErr, replaceErr)
	}
	_, createErr = games.CreateGame(context.Background(), admin, "Other Chess", nil, &bad, nil, nil)
	_, replaceErr = games.ReplaceGame(context.Background(), admin, gameID, chessName, nil, &bad, nil, nil)

	if !errors.Is(createErr, domain.ErrInvalidGenre) || !errors.Is(replaceErr, domain.ErrInvalidGenre) || editor.calls != 0 {
		t.Fatalf("errors %v and %v, editor calls %d; want ErrInvalidGenre and no write", createErr, replaceErr, editor.calls)
	}
}

func TestReplaceGameSetsAndClearsTheGenre(t *testing.T) {
	racing := domain.Genre("racing")
	editor := &fakeEditor{games: []domain.Game{{ID: gameID, Name: chessName}}}
	games := newAdminGames(&fakeCatalog{}, editor)

	set, err := games.ReplaceGame(context.Background(), admin, gameID, chessName, nil, &racing, nil, nil)
	if err != nil || set.Genre == nil || *editor.games[0].Genre != racing {
		t.Fatalf("game %+v, error %v; want genre racing stored", set, err)
	}
	cleared, err := games.ReplaceGame(context.Background(), admin, gameID, chessName, nil, nil, nil, nil)

	if err != nil || cleared.Genre != nil || editor.games[0].Genre != nil {
		t.Fatalf("game %+v, error %v; want a PUT without genre to clear it", cleared, err)
	}
}
