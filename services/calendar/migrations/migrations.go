// Package migrations embeds the versioned schema migrations of the calendar service (ADR 0012).
package migrations

import "embed"

// FS holds the migration files. goose reads them in order and runs each Up or Down in a transaction.
//
//go:embed *.sql
var FS embed.FS
