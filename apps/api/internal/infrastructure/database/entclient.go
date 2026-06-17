package database

import (
	"database/sql"

	entsql "entgo.io/ent/dialect/sql"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/unbindapp/unbind-api/ent"
	_ "modernc.org/sqlite"
)

func NewEntClient(connInfo SqlDBConn) (*ent.Client, *sql.DB, error) {
	db, err := sql.Open(connInfo.Driver(), connInfo.DSN())
	if err != nil {
		return nil, nil, err
	}

	drv := entsql.OpenDB(connInfo.Dialect(), db)
	return ent.NewClient(ent.Driver(drv)), db, nil
}
