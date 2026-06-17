package database

import (
	"testing"

	"entgo.io/ent/dialect"
	"github.com/stretchr/testify/assert"
	"github.com/unbindapp/unbind-api/config"
)

func TestGetSqlDbConnPostgres(t *testing.T) {
	conn, err := GetSqlDbConn(&config.Config{
		PostgresDB:       "pippin",
		PostgresHost:     "127.0.0.1",
		PostgresPassword: "password",
		PostgresPort:     5432,
		PostgresUser:     "user",
	}, false)
	assert.Nil(t, err)

	assert.Equal(t, "postgres://user:password@127.0.0.1:5432/pippin?sslmode=disable", conn.DSN())
	assert.Equal(t, dialect.Postgres, conn.Dialect())
	assert.Equal(t, "pgx", conn.Driver())
}

func TestGetSqlDbConnMock(t *testing.T) {
	conn, err := GetSqlDbConn(nil, true)
	assert.Nil(t, err)

	assert.Equal(t, "file:testing?cache=shared&mode=memory&_fk=1", conn.DSN())
	assert.Equal(t, "sqlite3", conn.Dialect())
	assert.Equal(t, "sqlite", conn.Driver())
}
