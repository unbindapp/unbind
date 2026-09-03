package variable_repo

import (
	"context"

	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/variablereference"
)

// Legacy variable_references rows that still need to be written into their service secret
func (self *VariableRepository) GetUnmigratedReferences(ctx context.Context) ([]*ent.VariableReference, error) {
	return self.base.DB.VariableReference.Query().
		Where(variablereference.MigratedAtIsNil()).
		Order(ent.Asc(variablereference.FieldCreatedAt)).
		All(ctx)
}
