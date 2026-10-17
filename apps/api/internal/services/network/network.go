package network_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
	system_repo "github.com/unbindapp/unbind-api/internal/repositories/system"
)

type PolicySyncer interface {
	Sync(ctx context.Context) error
}

type NetworkService struct {
	repo   repositories.RepositoriesInterface
	syncer PolicySyncer
}

func NewNetworkService(repo repositories.RepositoriesInterface, syncer PolicySyncer) *NetworkService {
	return &NetworkService{repo: repo, syncer: syncer}
}

func (self *NetworkService) GetSettings(ctx context.Context, requesterUserID uuid.UUID) (*models.NetworkSettingsResponse, error) {
	if err := self.checkSystemAdmin(ctx, requesterUserID); err != nil {
		return nil, err
	}
	return self.settings(ctx)
}

func (self *NetworkService) UpdateSettings(ctx context.Context, requesterUserID uuid.UUID, input *models.UpdateNetworkSettingsInput) (*models.NetworkSettingsResponse, error) {
	if err := self.checkSystemAdmin(ctx, requesterUserID); err != nil {
		return nil, err
	}

	if _, err := self.repo.System().UpdateSystemSettings(ctx, &system_repo.SystemSettingUpdateInput{
		TeamNetworkIsolation: &input.TeamNetworkIsolation,
	}); err != nil {
		return nil, err
	}
	if err := self.syncer.Sync(ctx); err != nil {
		return nil, errdefs.NewInternalError(err, "Saved, but applying the network policies failed")
	}
	return self.settings(ctx)
}

func (self *NetworkService) ListServices(ctx context.Context, requesterUserID uuid.UUID) ([]*models.NetworkServiceResponse, error) {
	if err := self.checkSystemAdmin(ctx, requesterUserID); err != nil {
		return nil, err
	}

	services, err := self.repo.System().GetServicesWithTeam(ctx)
	if err != nil {
		return nil, err
	}
	return models.TransformNetworkServiceEntities(services), nil
}

func (self *NetworkService) CreateException(ctx context.Context, requesterUserID uuid.UUID, input *models.CreateNetworkExceptionInput) (*models.NetworkExceptionResponse, error) {
	if err := self.checkSystemAdmin(ctx, requesterUserID); err != nil {
		return nil, err
	}

	target, err := self.service(ctx, input.TargetServiceID, "Target service not found")
	if err != nil {
		return nil, err
	}
	if input.SourceServiceID != nil {
		source, err := self.service(ctx, *input.SourceServiceID, "Source service not found")
		if err != nil {
			return nil, err
		}
		if source.TeamID == target.TeamID {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Services in the same team can already reach each other")
		}
	}

	exists, err := self.repo.System().NetworkExceptionExists(ctx, input.SourceServiceID, input.TargetServiceID)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeConflict, "This exception already exists")
	}

	exception, err := self.repo.System().CreateNetworkException(ctx, input.SourceServiceID, input.TargetServiceID)
	if err != nil {
		return nil, err
	}
	if err := self.syncer.Sync(ctx); err != nil {
		return nil, errdefs.NewInternalError(err, "Saved, but applying the network policies failed")
	}
	return models.TransformNetworkExceptionEntity(exception), nil
}

func (self *NetworkService) DeleteException(ctx context.Context, requesterUserID uuid.UUID, input *models.DeleteNetworkExceptionInput) error {
	if err := self.checkSystemAdmin(ctx, requesterUserID); err != nil {
		return err
	}

	if err := self.repo.System().DeleteNetworkException(ctx, input.ID); err != nil {
		if ent.IsNotFound(err) {
			return errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Network exception not found")
		}
		return err
	}
	if err := self.syncer.Sync(ctx); err != nil {
		return errdefs.NewInternalError(err, "Removed, but applying the network policies failed")
	}
	return nil
}

func (self *NetworkService) settings(ctx context.Context) (*models.NetworkSettingsResponse, error) {
	settings, err := self.repo.System().GetSystemSettings(ctx, nil)
	if err != nil {
		return nil, err
	}
	exceptions, err := self.repo.System().GetNetworkExceptions(ctx)
	if err != nil {
		return nil, err
	}
	return &models.NetworkSettingsResponse{
		TeamNetworkIsolation: settings.TeamNetworkIsolation,
		Exceptions:           models.TransformNetworkExceptionEntities(exceptions),
	}, nil
}

func (self *NetworkService) service(ctx context.Context, id uuid.UUID, notFoundMessage string) (*models.NetworkServiceResponse, error) {
	service, err := self.repo.System().GetServiceWithTeam(ctx, id)
	if ent.IsNotFound(err) {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, notFoundMessage)
	}
	if err != nil {
		return nil, err
	}
	return models.TransformNetworkServiceEntity(service), nil
}

func (self *NetworkService) checkSystemAdmin(ctx context.Context, requesterUserID uuid.UUID) error {
	return self.repo.Permissions().Check(ctx, requesterUserID, []permissions_repo.PermissionCheck{
		{Action: schema.ActionAdmin, ResourceType: schema.ResourceTypeSystem},
	})
}
