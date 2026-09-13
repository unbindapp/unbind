package databases

import (
	"fmt"
	"net"
	"net/url"
	"strconv"
)

// Connection describes how to reach a database. The same shape builds the
// in-cluster string and the internet-facing one, which differ only in address.
type Connection struct {
	Type     string
	Host     string
	Port     int32
	Username string
	Password string
	Database string
}

// StoredAddressKeys are the keys Unbind used to store on a database before its
// addresses became computed. They are removed wherever they are still found.
var StoredAddressKeys = []string{
	"DATABASE_HOST",
	"DATABASE_PORT",
	"DATABASE_URL",
	"DATABASE_HTTP_URL",
	"DATABASE_HTTP_PORT",
}

// DefaultPort is the port an engine answers its primary protocol on
func DefaultPort(databaseType string) int32 {
	switch databaseType {
	case "postgres":
		return 5432
	case "redis":
		return 6379
	case "mysql":
		return 3306
	case "mongodb":
		return 27017
	case "clickhouse":
		return 9000
	}
	return 0
}

// DefaultHTTPPort is the port an engine answers HTTP on, zero when it has no
// HTTP protocol
func DefaultHTTPPort(databaseType string) int32 {
	if databaseType == "clickhouse" {
		return 8123
	}
	return 0
}

// DefaultDatabaseName is the database an engine connects to when none is named
func DefaultDatabaseName(databaseType string) string {
	switch databaseType {
	case "mysql":
		return "moco"
	case "mongodb":
		return "admin"
	case "clickhouse":
		return "default"
	}
	return ""
}

// DefaultUsername is the user an engine is reached as when Unbind does not track
// one separately, empty when the engine's own credentials decide
func DefaultUsername(databaseType string) string {
	switch databaseType {
	case "redis":
		return "default"
	case "clickhouse":
		return "default"
	}
	return ""
}

// ConnectionString builds the engine's primary connection string. It returns
// empty for an unknown engine or an incomplete connection.
func ConnectionString(conn Connection) string {
	if conn.Host == "" || conn.Password == "" {
		return ""
	}

	username := conn.Username
	if username == "" {
		username = DefaultUsername(conn.Type)
	}
	port := conn.Port
	if port == 0 {
		port = DefaultPort(conn.Type)
	}
	database := conn.Database
	if database == "" {
		database = DefaultDatabaseName(conn.Type)
	}
	address := net.JoinHostPort(conn.Host, strconv.Itoa(int(port)))
	credentials := url.UserPassword(username, conn.Password).String()

	switch conn.Type {
	case "postgres":
		return fmt.Sprintf("postgresql://%s@%s/%s?sslmode=disable", credentials, address, database)
	case "redis":
		return fmt.Sprintf("redis://%s@%s", credentials, address)
	case "mysql":
		return fmt.Sprintf("mysql://%s@%s/%s", credentials, address, database)
	case "mongodb":
		return fmt.Sprintf("mongodb://%s@%s/%s?ssl=false", credentials, address, database)
	case "clickhouse":
		return fmt.Sprintf("clickhouse://%s@%s/%s", credentials, address, database)
	}
	return ""
}

// HTTPConnectionString builds the HTTP-protocol string for engines that have one,
// empty for the engines that do not
func HTTPConnectionString(conn Connection) string {
	if DefaultHTTPPort(conn.Type) == 0 || conn.Host == "" || conn.Password == "" {
		return ""
	}

	username := conn.Username
	if username == "" {
		username = DefaultUsername(conn.Type)
	}
	port := conn.Port
	if port == 0 {
		port = DefaultHTTPPort(conn.Type)
	}
	database := conn.Database
	if database == "" {
		database = DefaultDatabaseName(conn.Type)
	}
	return fmt.Sprintf("http://%s@%s/%s",
		url.UserPassword(username, conn.Password).String(),
		net.JoinHostPort(conn.Host, strconv.Itoa(int(port))),
		database,
	)
}
