package servicegroup_repo

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/service"
	"github.com/unbindapp/unbind-api/ent/servicegroup"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

func (self *ServiceGroupRepository) Create(ctx context.Context, tx repository.TxInterface, name string, icon, description *string, environmentID uuid.UUID) (*ent.ServiceGroup, error) {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}
	// Create service group
	return db.ServiceGroup.Create().
		SetName(name).
		SetNillableIcon(icon).
		SetNillableDescription(description).
		SetEnvironmentID(environmentID).
		Save(ctx)
}

func (self *ServiceGroupRepository) Update(ctx context.Context, input *models.UpdateServiceGroupInput) (*ent.ServiceGroup, error) {
	// Update service group
	updateStmt := self.base.DB.ServiceGroup.UpdateOneID(input.ID)
	if input.Name != nil {
		updateStmt.SetName(*input.Name)
	}
	if input.Icon != nil {
		if *input.Icon == "" {
			updateStmt.ClearIcon()
		} else {
			updateStmt.SetIcon(*input.Icon)
		}
	}
	if input.Description != nil {
		if *input.Description == "" {
			updateStmt.ClearDescription()
		} else {
			updateStmt.SetDescription(*input.Description)
		}
	}
	if len(input.AddServiceIDs) > 0 {
		updateStmt.AddServiceIDs(input.AddServiceIDs...)
	}
	if len(input.RemoveServiceIDs) > 0 {
		updateStmt.RemoveServiceIDs(input.RemoveServiceIDs...)
	}
	return updateStmt.Save(ctx)
}

func (self *ServiceGroupRepository) Delete(ctx context.Context, tx repository.TxInterface, id uuid.UUID) error {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}

	err := db.Service.Update().
		ClearServiceGroup().
		Where(service.ServiceGroupID(id)).
		Exec(ctx)
	if err != nil {
		return err
	}

	return db.ServiceGroup.DeleteOneID(id).Exec(ctx)
}

func (self *ServiceGroupRepository) DeleteByEnvironmentID(ctx context.Context, tx repository.TxInterface, environmentID uuid.UUID) error {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}
	_, err := db.ServiceGroup.Delete().
		Where(servicegroup.EnvironmentID(environmentID)).
		Exec(ctx)
	return err
}
