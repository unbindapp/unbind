package databases

import (
	"context"
	"fmt"
	"io"
	"net/http"

	"github.com/go-oauth2/oauth2/v4/errors"
)

var (
	BaseDatabaseURL = "https://raw.githubusercontent.com/unbindapp/unbind-custom-service-definitions/refs/tags/%s"
)

var (
	ErrDatabaseNotFound = errors.New("database not found")
)

// DatabaseProvider fetches database definitions from GitHub
type DatabaseProvider struct {
	client *http.Client
}

func NewDatabaseProvider() *DatabaseProvider {
	return &DatabaseProvider{
		client: http.DefaultClient,
	}
}

// fetchURL fetches a URL
func (self *DatabaseProvider) fetchURL(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := self.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		if resp.StatusCode == http.StatusNotFound {
			return nil, ErrDatabaseNotFound
		}
		return nil, fmt.Errorf("HTTP error: %s", resp.Status)
	}

	return io.ReadAll(resp.Body)
}
