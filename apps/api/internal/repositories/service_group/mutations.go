package servicegroup_repo

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/service"
	"github.com/unbindapp/unbind-api/ent/servicegroup"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	service_repo "github.com/unbindapp/unbind-api/internal/repositories/service"
)

func (self *ServiceGroupRepository) Create(ctx context.Context, tx repository.TxInterface, name string, icon, description *string, environmentID uuid.UUID, templateID *uuid.UUID) (*ent.ServiceGroup, error) {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}
	// New groups go to the top of the environment
	position, err := service_repo.TopLevelPositionAbove(ctx, db, environmentID)
	if err != nil {
		return nil, err
	}

	return db.ServiceGroup.Create().
		SetPosition(position).
		SetName(name).
		SetNillableIcon(icon).
		SetNillableDescription(description).
		SetEnvironmentID(environmentID).
		SetNillableTemplateID(templateID).
		Save(ctx)
}

func (self *ServiceGroupRepository) Update(ctx context.Context, input *models.UpdateServiceGroupInput) (*ent.ServiceGroup, error) {
	var group *ent.ServiceGroup
	err := self.base.WithTx(ctx, func(tx repository.TxInterface) error {
		db := tx.Client()
		updateStmt := db.ServiceGroup.UpdateOneID(input.ID)
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

		// Services that join go to the top of the group, ones that leave to the top of the environment
		if len(input.AddServiceIDs) > 0 {
			position, err := service_repo.GroupPositionAbove(ctx, db, input.ID)
			if err != nil {
				return err
			}
			if err := db.Service.Update().
				Where(service.IDIn(input.AddServiceIDs...)).
				SetPosition(position).
				Exec(ctx); err != nil {
				return err
			}
			updateStmt.AddServiceIDs(input.AddServiceIDs...)
		}
		if len(input.RemoveServiceIDs) > 0 {
			position, err := service_repo.TopLevelPositionAbove(ctx, db, input.EnvironmentID)
			if err != nil {
				return err
			}
			if err := db.Service.Update().
				Where(service.IDIn(input.RemoveServiceIDs...)).
				SetPosition(position).
				Exec(ctx); err != nil {
				return err
			}
			updateStmt.RemoveServiceIDs(input.RemoveServiceIDs...)
		}

		var err error
		group, err = updateStmt.Save(ctx)
		return err
	})
	return group, err
}

func (self *ServiceGroupRepository) Delete(ctx context.Context, tx repository.TxInterface, id uuid.UUID) error {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}

	group, err := db.ServiceGroup.Get(ctx, id)
	if err != nil {
		return err
	}

	// The group's services stay where the group was
	err = db.Service.Update().
		ClearServiceGroup().
		SetPosition(group.Position).
		Where(service.ServiceGroupID(id)).
		Exec(ctx)
	if err != nil {
		return err
	}

	return db.ServiceGroup.DeleteOneID(id).Exec(ctx)
}

func (self *ServiceGroupRepository) DeleteIfEmpty(ctx context.Context, tx repository.TxInterface, id uuid.UUID) error {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}

	// Locks the group row so concurrent service deletions check one at a time
	lockedCount, err := db.ServiceGroup.Update().
		Where(servicegroup.ID(id)).
		SetUpdatedAt(time.Now()).
		Save(ctx)
	if err != nil {
		return err
	}
	if lockedCount == 0 {
		return nil
	}

	hasServices, err := db.Service.Query().
		Where(service.ServiceGroupID(id)).
		Exist(ctx)
	if err != nil {
		return err
	}
	if hasServices {
		return nil
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
