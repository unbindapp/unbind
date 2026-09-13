package databases

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestConnectionString(t *testing.T) {
	tests := []struct {
		name string
		conn Connection
		want string
	}{
		{
			"postgres",
			Connection{Type: "postgres", Host: "pg.svc", Username: "unbind", Password: "pw", Database: "primarydb"},
			"postgresql://unbind:pw@pg.svc:5432/primarydb?sslmode=disable",
		},
		{
			"redis defaults its user",
			Connection{Type: "redis", Host: "redis.svc", Password: "pw"},
			"redis://default:pw@redis.svc:6379",
		},
		{
			"mysql",
			Connection{Type: "mysql", Host: "moco.svc", Username: "moco-writable", Password: "pw"},
			"mysql://moco-writable:pw@moco.svc:3306/moco",
		},
		{
			"mongodb",
			Connection{Type: "mongodb", Host: "mongo.svc", Username: "root", Password: "pw"},
			"mongodb://root:pw@mongo.svc:27017/admin?ssl=false",
		},
		{
			"clickhouse speaks its native protocol",
			Connection{Type: "clickhouse", Host: "ch.svc", Password: "pw"},
			"clickhouse://default:pw@ch.svc:9000/default",
		},
		{
			// The public string is the same builder against the external address
			"an explicit port is the external one",
			Connection{Type: "postgres", Host: "203.0.113.4", Port: 30001, Username: "unbind", Password: "pw", Database: "primarydb"},
			"postgresql://unbind:pw@203.0.113.4:30001/primarydb?sslmode=disable",
		},
		{
			"a password with url syntax in it is encoded",
			Connection{Type: "postgres", Host: "pg.svc", Username: "unbind", Password: "p@ss/word", Database: "primarydb"},
			"postgresql://unbind:p%40ss%2Fword@pg.svc:5432/primarydb?sslmode=disable",
		},
		{"no password is not a connection", Connection{Type: "postgres", Host: "pg.svc", Username: "unbind"}, ""},
		{"no host is not a connection", Connection{Type: "postgres", Password: "pw"}, ""},
		{"an unknown engine has no format", Connection{Type: "cassandra", Host: "c.svc", Password: "pw"}, ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, ConnectionString(tt.conn))
		})
	}
}

func TestHTTPConnectionString(t *testing.T) {
	conn := Connection{Type: "clickhouse", Host: "ch.svc", Password: "pw"}
	assert.Equal(t, "http://default:pw@ch.svc:8123/default", HTTPConnectionString(conn))

	// Only ClickHouse has a second protocol
	assert.Empty(t, HTTPConnectionString(Connection{Type: "postgres", Host: "pg.svc", Password: "pw"}))
}
