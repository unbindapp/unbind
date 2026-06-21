package variable_repo

import (
	"context"
	"strings"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/variablereference"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

func (self *VariableRepository) UpdateReferences(ctx context.Context, tx repository.TxInterface, behavior models.VariableUpdateBehavior, targetServiceID uuid.UUID, items []*models.VariableReferenceInputItem) ([]*ent.VariableReference, error) {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}
	if behavior == models.VariableUpdateBehaviorOverwrite {
		if _, err := db.VariableReference.Delete().
			Where(variablereference.TargetServiceIDEQ(targetServiceID)).
			Exec(ctx); err != nil {
			return nil, err
		}
	}

	var references []*ent.VariableReference

	for _, reference := range items {
		ref := db.VariableReference.Create().
			SetTargetServiceID(targetServiceID).
			SetTargetName(strings.TrimSpace(reference.Name)).
			SetSources(reference.Sources).
			SetValueTemplate(reference.Value)

		if behavior == models.VariableUpdateBehaviorUpsert {
			ref.OnConflictColumns(
				variablereference.FieldTargetServiceID, variablereference.FieldTargetName,
			).UpdateNewValues().ClearError()
		}

		reference, err := ref.Save(ctx)
		if err != nil {
			return nil, err
		}

		references = append(references, reference)
	}

	return references, nil
}

func (self *VariableRepository) AttachError(ctx context.Context, id uuid.UUID, err error) (*ent.VariableReference, error) {
	return self.base.DB.VariableReference.UpdateOneID(id).
		SetError(err.Error()).
		Save(ctx)
}

func (self *VariableRepository) ClearError(ctx context.Context, id uuid.UUID) (*ent.VariableReference, error) {
	return self.base.DB.VariableReference.UpdateOneID(id).
		ClearError().
		Save(ctx)
}

func (self *VariableRepository) DeleteReferences(ctx context.Context, tx repository.TxInterface, targetServiceID uuid.UUID, ids []uuid.UUID) (int, error) {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}
	return db.VariableReference.Delete().
		Where(
			variablereference.TargetServiceIDEQ(targetServiceID),
			variablereference.IDIn(ids...),
		).
		Exec(ctx)
}
