package bootstrap_repo

import (
	"context"

	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

func (self *BootstrapRepository) IsBootstrapped(ctx context.Context, tx repository.TxInterface) (userExists bool, isBootstrapped bool, err error) {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}

	userCount, err := db.User.Query().Count(ctx)
	if err != nil {
		return false, false, err
	}
	userExists = userCount > 0

	// A user existing implies bootstrap completed: CreateUser writes both in one
	// transaction. Fall back to the Bootstrap row for older installs.
	if userExists {
		return true, true, nil
	}

	exists, err := db.Bootstrap.Query().Exist(ctx)
	if err != nil {
		return userExists, false, err
	}
	return userExists, exists, nil
}
