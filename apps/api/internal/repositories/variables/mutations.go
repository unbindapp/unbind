package variable_repo

import (
	"context"
	"time"

	"github.com/google/uuid"
)

func (self *VariableRepository) MarkReferenceMigrated(ctx context.Context, id uuid.UUID) error {
	return self.base.DB.VariableReference.UpdateOneID(id).
		SetMigratedAt(time.Now()).
		Exec(ctx)
}
