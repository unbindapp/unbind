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
		{
			"postgres over tls requires encryption without a trusted ca",
			Connection{Type: "postgres", Host: "203.0.113.4", Port: 30001, Username: "unbind", Password: "pw", Database: "primarydb", TLS: true},
			"postgresql://unbind:pw@203.0.113.4:30001/primarydb?sslmode=require",
		},
		{
			"redis over tls uses the rediss scheme",
			Connection{Type: "redis", Host: "203.0.113.4", Port: 30002, Password: "pw", TLS: true},
			"rediss://default:pw@203.0.113.4:30002",
		},
		{
			"mysql negotiates tls on its own so the string does not change",
			Connection{Type: "mysql", Host: "203.0.113.4", Port: 30003, Username: "moco-writable", Password: "pw", TLS: true},
			"mysql://moco-writable:pw@203.0.113.4:30003/moco",
		},
		{
			"mongodb over tls accepts the self-signed certificate",
			Connection{Type: "mongodb", Host: "203.0.113.4", Port: 30004, Username: "root", Password: "pw", TLS: true},
			"mongodb://root:pw@203.0.113.4:30004/admin?tls=true&tlsAllowInvalidCertificates=true",
		},
		{
			"clickhouse over tls skips verification",
			Connection{Type: "clickhouse", Host: "203.0.113.4", Port: 30005, Password: "pw", TLS: true},
			"clickhouse://default:pw@203.0.113.4:30005/default?secure=true&skip_verify=true",
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

	assert.Equal(t, "https://default:pw@203.0.113.4:30006/default", HTTPConnectionString(Connection{Type: "clickhouse", Host: "203.0.113.4", Port: 30006, Password: "pw", TLS: true}))
}

func TestTLSPort(t *testing.T) {
	tests := []struct {
		dbType string
		port   int32
		want   int32
	}{
		{"redis", 6379, 6380},
		{"clickhouse", 9000, 9440},
		{"clickhouse", 8123, 8443},
		{"postgres", 5432, 5432},
		{"mysql", 3306, 3306},
		{"mongodb", 27017, 27017},
		{"redis", 7000, 7000},
	}
	for _, tt := range tests {
		assert.Equal(t, tt.want, TLSPort(tt.dbType, tt.port), "%s %d", tt.dbType, tt.port)
	}
}
