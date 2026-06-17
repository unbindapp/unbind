package bootstrap_repo

import (
	"context"

	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	"golang.org/x/crypto/bcrypt"
)

// Create initial bootstrap user, added to all groups
func (self *BootstrapRepository) CreateUser(ctx context.Context, email, password string) (user *ent.User, err error) {
	if err := self.base.WithTx(ctx, func(tx repository.TxInterface) error {
		// Check if bootstrapped
		userExists, bootstrapped, err := self.IsBootstrapped(ctx, tx)
		if err != nil {
			return err
		}
		if bootstrapped || userExists {
			return errdefs.ErrAlreadyBootstrapped
		}

		// Hash the password
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			log.Errorf("Error hashing password: %v\n", err)
			return err
		}

		// Create the user
		user, err = tx.Client().User.Create().
			SetEmail(email).
			SetPasswordHash(string(hashedPassword)).
			Save(ctx)
		if err != nil {
			log.Errorf("Error creating user: %v\n", err)
			return err
		}

		// Add user to all existing groups
		groups, err := tx.Client().Group.Query().All(ctx)
		if err != nil {
			log.Errorf("Error querying groups: %v\n", err)
			return err
		}

		user, err = tx.Client().User.UpdateOneID(user.ID).
			AddGroups(groups...).
			Save(ctx)
		if err != nil {
			log.Errorf("Error adding user to groups: %v\n", err)
			return err
		}

		if _, err := tx.Client().Bootstrap.Create().SetIsBootstrapped(true).Save(ctx); err != nil {
			log.Errorf("Error marking bootstrapped: %v\n", err)
			return err
		}

		return nil
	}); err != nil {
		return nil, err
	}

	return user, nil
}
