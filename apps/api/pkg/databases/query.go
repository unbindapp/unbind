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

// ListDatabases lists all available databases
func (self *DatabaseProvider) ListDatabases(ctx context.Context, tagVersion string) ([]string, error) {
	// Base version URL
	baseURL := fmt.Sprintf(BaseDatabaseURL, tagVersion)

	// Fetch the index file that contains all categories and definitions
	indexURL := fmt.Sprintf("%s/index.json", baseURL)

	indexBytes, err := self.fetchURL(ctx, indexURL)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch template index: %w", err)
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
