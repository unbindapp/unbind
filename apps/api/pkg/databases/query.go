package databases

import (
	"context"
	"encoding/json"
	"fmt"
)

const DB_CATEGORY = "databases"

type IndexResponse struct {
	Categories []struct {
		Name      string   `json:"name"`
		Templates []string `json:"templates"`
	} `json:"categories"`
}

// ListDatabases lists all available databases. The version argument is retained
// for call-site compatibility; definitions now ship embedded in the binary.
func (self *DatabaseProvider) ListDatabases(_ context.Context, _ string) ([]string, error) {
	indexBytes, err := self.readAsset("index.json")
	if err != nil {
		return nil, fmt.Errorf("failed to read template index: %w", err)
	}

	// Parse the index
	var index IndexResponse
	if err := json.Unmarshal(indexBytes, &index); err != nil {
		return nil, fmt.Errorf("failed to parse template index: %w", err)
	}

	dbList := []string{}
	for _, category := range index.Categories {
		if category.Name == DB_CATEGORY {
			dbList = append(dbList, category.Templates...)
			break
		}
	}

	return dbList, nil
}
