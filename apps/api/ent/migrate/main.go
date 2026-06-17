//go:build ignore

package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"

	atlasMigrate "ariga.io/atlas/sql/migrate"
	"ariga.io/atlas/sql/sqltool"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/sql/schema"
	embeddedpostgres "github.com/fergusstrange/embedded-postgres"
	"github.com/unbindapp/unbind-api/ent/migrate"
)

func regenerateChecksum(directory *sqltool.GooseDir) error {
	hashFile, err := directory.Checksum()
	if err != nil {
		return fmt.Errorf("failed to generate checksum: %w", err)
	}

	// Write the new hash file
	if err := atlasMigrate.WriteSumFile(directory, hashFile); err != nil {
		return fmt.Errorf("failed to write hash file: %w", err)
	}

	return nil
}

func main() {
	ctx := context.Background()

	// Get the directory where main.go is located
	_, thisFile, _, _ := runtime.Caller(0)

	// Define migrations directory relative to main.go
	migrationsDir := filepath.Join(thisFile, "../migrations")

	gooseDir, err := sqltool.NewGooseDir(migrationsDir)
	if err != nil {
		fmt.Printf("Error creating atlas directory: %v\n", err)
		os.Exit(1)
	}

	// Parse command line flags
	name := flag.String("name", "", "Name of the migration to create")
	checksum := flag.Bool("checksum", false, "Regenerate atlas checksum")
	flag.Parse()

	// Ensure migrations directory exists
	if err := os.MkdirAll(migrationsDir, 0755); err != nil {
		fmt.Printf("Error creating migrations directory: %v\n", err)
		os.Exit(1)
	}

	// * Handle checksum regeneration
	if *checksum {
		// Regenerate checksum
		if err := regenerateChecksum(gooseDir); err != nil {
			fmt.Printf("Error regenerating checksum: %v\n", err)
			os.Exit(1)
		}

		fmt.Println("Checksum regenerated successfully")
		return
	}

	// Handle migration creation
	if *name == "" {
		fmt.Println("Error: migration name is required")
		flag.Usage()
		os.Exit(1)
	}

	/// * Create migration
	// Keep track of files we started with
	startingFiles, err := gooseDir.Files()
	if err != nil {
		fmt.Printf("Error getting files: %v\n", err)
		return
	}

	opts := []schema.MigrateOption{
		schema.WithDir(gooseDir),
		schema.WithMigrationMode(schema.ModeReplay),
		schema.WithDialect(dialect.Postgres),
		schema.WithDropColumn(true),
		schema.WithDropIndex(true),
		schema.WithIndent("  "),
		schema.WithFormatter(sqltool.GooseFormatter),
	}

	// Setup embedded postgres
	port := 34518
	ep := embeddedpostgres.NewDatabase(
		embeddedpostgres.DefaultConfig().
			Version(embeddedpostgres.V16).
			Port(uint32(port)).
			StartTimeout(30 * time.Second).
			Logger(io.Discard),
	)
	if err := ep.Start(); err != nil {
		fmt.Printf("Error starting embedded postgres: %v\n", err)
		return
	}
	defer func() {
		if err := ep.Stop(); err != nil {
			fmt.Printf("Error stopping embedded postgres: %v\n", err)
		}
	}()

	dbConnString := fmt.Sprintf("postgres://postgres:postgres@localhost:%d/postgres?sslmode=disable", port)

	if err = migrate.NamedDiff(
		ctx,
		dbConnString,
		*name,
		opts...,
	); err != nil {
		fmt.Printf("Error creating migration: %v\n", err)
		return
	}

	afterFiles, err := gooseDir.Files()
	if err != nil {
		fmt.Printf("Error getting files: %v\n", err)
		return
	}

	// Diff the two
	diff := diffFiles(startingFiles, afterFiles)
	if len(diff) == 0 {
		fmt.Println("No new migration files created")
		return
	}

	// Print the new migration files
	fmt.Println("New migration files created:")
	for _, file := range diff {
		if strings.HasPrefix(file, "U") {
			fmt.Printf("- %s (reversal)\n", file)
			continue
		}
		fmt.Printf("- %s\n", file)
	}
}

// Diff the files in the starting directory with the files in the after directory
func diffFiles(startingFiles, afterFiles []atlasMigrate.File) []string {
	beforeMap := make(map[string]atlasMigrate.File)
	for _, file := range startingFiles {
		beforeMap[file.Name()] = file
	}

	var diff []string
	for _, file := range afterFiles {
		if _, exists := beforeMap[file.Name()]; !exists {
			diff = append(diff, file.Name())
		}
	}
	sort.Strings(diff)
	return diff
}
