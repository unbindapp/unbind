package service_repo

import (
	"cmp"
	"context"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/service"
	"github.com/unbindapp/unbind-api/ent/servicegroup"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

// An environment's custom order has two levels: its groups and ungrouped
// services share one order, and each group orders its own services.

// TopLevelPositionAbove is the position that puts a new group or ungrouped
// service before everything else in the environment
func TopLevelPositionAbove(ctx context.Context, db *ent.Client, environmentID uuid.UUID) (int, error) {
	services, err := db.Service.Query().
		Where(service.EnvironmentID(environmentID), service.ServiceGroupIDIsNil()).
		Order(service.ByPosition()).
		Limit(1).
		Select(service.FieldPosition).
		Ints(ctx)
	if err != nil {
		return 0, err
	}
	groups, err := db.ServiceGroup.Query().
		Where(servicegroup.EnvironmentID(environmentID)).
		Order(servicegroup.ByPosition()).
		Limit(1).
		Select(servicegroup.FieldPosition).
		Ints(ctx)
	if err != nil {
		return 0, err
	}
	return repository.PositionAbove(append(services, groups...)), nil
}

// GroupPositionAbove is the position that puts a service before the others in its group
func GroupPositionAbove(ctx context.Context, db *ent.Client, groupID uuid.UUID) (int, error) {
	positions, err := db.Service.Query().
		Where(service.ServiceGroupID(groupID)).
		Order(service.ByPosition()).
		Limit(1).
		Select(service.FieldPosition).
		Ints(ctx)
	if err != nil {
		return 0, err
	}
	return repository.PositionAbove(positions), nil
}

type orderKey struct {
	position  int
	createdAt time.Time
	id        uuid.UUID
}

// Items that share a position, like ones never reordered, go newest first
func compareKeys(a, b orderKey) int {
	return cmp.Or(
		cmp.Compare(a.position, b.position),
		b.createdAt.Compare(a.createdAt),
		strings.Compare(a.id.String(), b.id.String()),
	)
}

func blockKey(s *ent.Service) orderKey {
	if g := s.Edges.ServiceGroup; g != nil {
		return orderKey{g.Position, g.CreatedAt, g.ID}
	}
	return orderKey{s.Position, s.CreatedAt, s.ID}
}

// SortServices orders services in place. Custom keeps each group's services
// together where the group sits; the other fields sort the services flat.
// Grouped services need their ServiceGroup edge loaded.
func SortServices(services []*ent.Service, sortField models.SortByField, sortOrder models.SortOrder) {
	if sortOrder == "" {
		sortOrder = sortField.DefaultOrder()
	}

	var compare func(a, b *ent.Service) int
	switch sortField {
	case models.SortByCustom:
		compare = func(a, b *ent.Service) int {
			return cmp.Or(
				compareKeys(blockKey(a), blockKey(b)),
				compareKeys(orderKey{a.Position, a.CreatedAt, a.ID}, orderKey{b.Position, b.CreatedAt, b.ID}),
			)
		}
	case models.SortByName:
		compare = func(a, b *ent.Service) int {
			return cmp.Or(
				strings.Compare(strings.ToLower(a.Name), strings.ToLower(b.Name)),
				strings.Compare(a.Name, b.Name),
				strings.Compare(a.ID.String(), b.ID.String()),
			)
		}
	case models.SortByUpdatedAt:
		compare = func(a, b *ent.Service) int {
			return cmp.Or(a.UpdatedAt.Compare(b.UpdatedAt), strings.Compare(a.ID.String(), b.ID.String()))
		}
	default:
		compare = func(a, b *ent.Service) int {
			return cmp.Or(a.CreatedAt.Compare(b.CreatedAt), strings.Compare(a.ID.String(), b.ID.String()))
		}
	}

	if sortOrder == models.SortOrderDesc {
		slices.SortStableFunc(services, func(a, b *ent.Service) int { return compare(b, a) })
		return
	}
	slices.SortStableFunc(services, compare)
}

// ReorderEnvironment puts the given groups and ungrouped services first, in
// the given order. The environment's others follow in the order they had.
func (self *ServiceRepository) ReorderEnvironment(ctx context.Context, tx repository.TxInterface, environmentID uuid.UUID, ids []uuid.UUID) error {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}

	services, err := db.Service.Query().
		Where(service.EnvironmentID(environmentID), service.ServiceGroupIDIsNil()).
		Select(service.FieldID, service.FieldPosition, service.FieldCreatedAt, service.FieldUpdatedAt).
		All(ctx)
	if err != nil {
		return err
	}
	groups, err := db.ServiceGroup.Query().
		Where(servicegroup.EnvironmentID(environmentID)).
		Select(servicegroup.FieldID, servicegroup.FieldPosition, servicegroup.FieldCreatedAt, servicegroup.FieldUpdatedAt).
		All(ctx)
	if err != nil {
		return err
	}

	keys := make([]orderKey, 0, len(services)+len(groups))
	updatedAt := make(map[uuid.UUID]time.Time, len(services)+len(groups))
	isGroup := make(map[uuid.UUID]bool, len(groups))
	for _, s := range services {
		keys = append(keys, orderKey{s.Position, s.CreatedAt, s.ID})
		updatedAt[s.ID] = s.UpdatedAt
	}
	for _, g := range groups {
		keys = append(keys, orderKey{g.Position, g.CreatedAt, g.ID})
		updatedAt[g.ID] = g.UpdatedAt
		isGroup[g.ID] = true
	}

	changed, err := repository.Arrange(positioned(keys), ids, func(id uuid.UUID) string {
		return fmt.Sprintf("%s is not a service group or an ungrouped service in this environment", id)
	})
	if err != nil {
		return err
	}

	// Moving a service or group is not an edit of it, so updated_at stays
	for _, id := range repository.WriteOrder(changed) {
		if isGroup[id] {
			err = db.ServiceGroup.UpdateOneID(id).SetPosition(changed[id]).SetUpdatedAt(updatedAt[id]).Exec(ctx)
		} else {
			err = db.Service.UpdateOneID(id).SetPosition(changed[id]).SetUpdatedAt(updatedAt[id]).Exec(ctx)
		}
		if err != nil {
			return err
		}
	}
	return nil
}

// ReorderGroup puts the given services of a group first, in the given order.
// The group's other services follow in the order they had.
func (self *ServiceRepository) ReorderGroup(ctx context.Context, tx repository.TxInterface, groupID uuid.UUID, serviceIDs []uuid.UUID) error {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}

	services, err := db.Service.Query().
		Where(service.ServiceGroupID(groupID)).
		Select(service.FieldID, service.FieldPosition, service.FieldCreatedAt, service.FieldUpdatedAt).
		All(ctx)
	if err != nil {
		return err
	}

	keys := make([]orderKey, len(services))
	updatedAt := make(map[uuid.UUID]time.Time, len(services))
	for i, s := range services {
		keys[i] = orderKey{s.Position, s.CreatedAt, s.ID}
		updatedAt[s.ID] = s.UpdatedAt
	}

	changed, err := repository.Arrange(positioned(keys), serviceIDs, func(id uuid.UUID) string {
		return fmt.Sprintf("Service %s is not in this group", id)
	})
	if err != nil {
		return err
	}

	for _, id := range repository.WriteOrder(changed) {
		if err := db.Service.UpdateOneID(id).SetPosition(changed[id]).SetUpdatedAt(updatedAt[id]).Exec(ctx); err != nil {
			return err
		}
	}
	return nil
}

// positioned lists the keys in their current order
func positioned(keys []orderKey) []repository.Positioned {
	slices.SortFunc(keys, compareKeys)
	items := make([]repository.Positioned, len(keys))
	for i, k := range keys {
		items[i] = repository.Positioned{ID: k.id, Position: k.position}
	}
	return items
}
