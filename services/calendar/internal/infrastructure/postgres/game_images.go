package postgres

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jackc/pgx/v5/pgconn"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

const (
	// A new upload replaces the image of the kind, so a game has at most one per kind.
	saveGameImageSQL = `INSERT INTO game_images (game_id, kind, media_type, version, image) VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (game_id, kind) DO UPDATE SET media_type = EXCLUDED.media_type, version = EXCLUDED.version, image = EXCLUDED.image`
	// One statement deletes the image and tells whether the game exists, so a missing image is no error.
	deleteGameImageSQL = `WITH removed AS (DELETE FROM game_images WHERE game_id = $1 AND kind = $2)
		SELECT EXISTS (SELECT 1 FROM games WHERE id = $1)`
	findGameImageSQL = `SELECT kind, media_type, version, image FROM game_images WHERE game_id = $1 AND kind = $2 AND version = $3`
)

// foreignKeyViolation is the SQLSTATE of a foreign key constraint.
const foreignKeyViolation = "23503"

// gameImagesGameFK is the foreign key that a write for a missing game breaks (ADR 0026 point 7).
const gameImagesGameFK = "game_images_game_id_fkey"

// gameImageRepo implements application.GameImageRepository.
type gameImageRepo struct{ s *Store }

var _ application.GameImageRepository = gameImageRepo{}

// GameImages returns the game image repository.
func (s *Store) GameImages() gameImageRepo { return gameImageRepo{s} }

// Save stores the image and returns the game as stored, read in the same transaction, or gives ErrGameNotFound when no
// game has the ID.
func (r gameImageRepo) Save(ctx context.Context, gameID string, image domain.GameImage) (stored domain.Game, err error) {
	err = r.s.inTx(ctx, func(tx *sql.Tx) error {
		_, err := tx.ExecContext(ctx, saveGameImageSQL, gameID, image.Kind, image.MediaType, image.Version, image.Data)
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == foreignKeyViolation && pgErr.ConstraintName == gameImagesGameFK {
			return application.ErrGameNotFound
		}
		if err != nil {
			return err
		}
		stored, err = loadGame(ctx, tx, selectGameSQL, gameID)
		return err
	})
	return stored, gameWriteError(err)
}

// Delete removes the image of the kind. ErrGameNotFound only when the game does not exist.
func (r gameImageRepo) Delete(ctx context.Context, gameID, kind string) error {
	var gameExists bool
	if err := r.s.db.QueryRowContext(ctx, deleteGameImageSQL, gameID, kind).Scan(&gameExists); err != nil {
		return gameWriteError(err)
	}
	if !gameExists {
		return application.ErrGameNotFound
	}
	return nil
}

// Find returns the image of the kind at the version with its bytes, and false when there is none, so a stale version
// never loads the bytes.
func (r gameImageRepo) Find(ctx context.Context, gameID, kind, version string) (domain.GameImage, bool, error) {
	var image domain.GameImage
	err := r.s.db.QueryRowContext(ctx, findGameImageSQL, gameID, kind, version).Scan(&image.Kind, &image.MediaType, &image.Version, &image.Data)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return domain.GameImage{}, false, nil
	case err != nil:
		return domain.GameImage{}, false, translate(err)
	}
	return image, true, nil
}
