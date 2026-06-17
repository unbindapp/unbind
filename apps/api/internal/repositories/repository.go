// Base repository package
package repository

import (
	"context"
	"fmt"
	"runtime/debug"

	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/common/log"
	// other imports
)

// BaseRepository provides common database functionality
//
//go:generate go run -mod=mod github.com/vburenin/ifacemaker -f "*.go" -i BaseRepositoryInterface -p repository -s BaseRepository -o repository_iface.go
type BaseRepository struct {
	DB *ent.Client
}

// NewBaseRepository creates a new repository
func NewBaseRepository(db *ent.Client) *BaseRepository {
	return &BaseRepository{DB: db}
}

// WithTx runs a function in a transaction
// Usage example:
//
//	if err := r.WithTx(func(tx *ent.Tx) error {
//		 Do stuff with tx
//		return nil
//	}); err != nil {
//
//		 Handle error
//	}
func (r *BaseRepository) WithTx(ctx context.Context, fn func(tx TxInterface) error) error {
	tx, err := r.DB.Tx(ctx)
	if err != nil {
		return err
	}
	defer func() {
		if v := recover(); v != nil {
			log.Errorf("Panic caught in WithTX: %v", string(debug.Stack()))
			_ = tx.Rollback()
			// Re-panic to pass upstream
			panic(v)
		}
	}()
	if err := fn(tx); err != nil {
		if rerr := tx.Rollback(); rerr != nil {
			err = fmt.Errorf("%w: rolling back transaction: %v", err, rerr)
		}
		return err
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("committing transaction: %w", err)
	}
	return nil
}

type TxInterface interface {
	Commit() error
	Rollback() error
	Client() *ent.Client
}
