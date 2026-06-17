package databases

import (
	"errors"
	"io/fs"
	"path"
)

const assetsRoot = "assets"

var ErrDatabaseNotFound = errors.New("database not found")

// DatabaseProvider serves database definitions embedded in the binary.
type DatabaseProvider struct {
	fs fs.FS
}

func NewDatabaseProvider() *DatabaseProvider {
	return &DatabaseProvider{
		fs: assetsFS,
	}
}

// readAsset reads a definition file relative to the embedded assets root.
func (self *DatabaseProvider) readAsset(relPath string) ([]byte, error) {
	data, err := fs.ReadFile(self.fs, path.Join(assetsRoot, relPath))
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return nil, ErrDatabaseNotFound
		}
		return nil, err
	}
	return data, nil
}
