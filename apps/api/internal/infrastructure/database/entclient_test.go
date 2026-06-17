package database

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNewEntClient(t *testing.T) {
	dbconn, _ := GetSqlDbConn(nil, true)

	client, sqlDB, err := NewEntClient(dbconn)
	assert.Nil(t, err)
	assert.NotNil(t, sqlDB)
	assert.NotNil(t, client)
}
