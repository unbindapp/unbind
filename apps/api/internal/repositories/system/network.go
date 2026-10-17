package system_repo

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/networkexception"
	"github.com/unbindapp/unbind-api/ent/service"
)

func withServiceTeam(sq *ent.ServiceQuery) {
	sq.WithEnvironment(func(eq *ent.EnvironmentQuery) {
		eq.WithProject(func(pq *ent.ProjectQuery) {
			pq.WithTeam()
		})
	})
}

func (self *SystemRepository) GetNetworkExceptions(ctx context.Context) ([]*ent.NetworkException, error) {
	return self.base.DB.NetworkException.Query().
		WithSourceService(withServiceTeam).
		WithTargetService(withServiceTeam).
		Order(ent.Asc(networkexception.FieldCreatedAt)).
		All(ctx)
}

func (self *SystemRepository) GetNetworkException(ctx context.Context, id uuid.UUID) (*ent.NetworkException, error) {
	return self.base.DB.NetworkException.Query().
		Where(networkexception.ID(id)).
		WithSourceService(withServiceTeam).
		WithTargetService(withServiceTeam).
		Only(ctx)
}

func (self *SystemRepository) NetworkExceptionExists(ctx context.Context, sourceServiceID *uuid.UUID, targetServiceID uuid.UUID) (bool, error) {
	q := self.base.DB.NetworkException.Query().
		Where(networkexception.TargetServiceID(targetServiceID))
	if sourceServiceID == nil {
		return q.Where(networkexception.SourceServiceIDIsNil()).Exist(ctx)
	}
	return q.Where(networkexception.SourceServiceID(*sourceServiceID)).Exist(ctx)
}

func (self *SystemRepository) CreateNetworkException(ctx context.Context, sourceServiceID *uuid.UUID, targetServiceID uuid.UUID) (*ent.NetworkException, error) {
	created, err := self.base.DB.NetworkException.Create().
		SetNillableSourceServiceID(sourceServiceID).
		SetTargetServiceID(targetServiceID).
		Save(ctx)
	if err != nil {
		return nil, err
	}
	return self.GetNetworkException(ctx, created.ID)
}

func (self *SystemRepository) DeleteNetworkException(ctx context.Context, id uuid.UUID) error {
	return self.base.DB.NetworkException.DeleteOneID(id).Exec(ctx)
}

func (self *SystemRepository) GetServicesWithTeam(ctx context.Context) ([]*ent.Service, error) {
	q := self.base.DB.Service.Query().Order(ent.Asc(service.FieldName))
	withServiceTeam(q)
	return q.All(ctx)
}

func (self *SystemRepository) GetServiceWithTeam(ctx context.Context, id uuid.UUID) (*ent.Service, error) {
	q := self.base.DB.Service.Query().Where(service.ID(id))
	withServiceTeam(q)
	return q.Only(ctx)
}
