package permissions_repo

import (
	"github.com/unbindapp/unbind-api/ent"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	environment_repo "github.com/unbindapp/unbind-api/internal/repositories/environment"
	project_repo "github.com/unbindapp/unbind-api/internal/repositories/project"
	service_repo "github.com/unbindapp/unbind-api/internal/repositories/service"
	team_repo "github.com/unbindapp/unbind-api/internal/repositories/team"
	user_repo "github.com/unbindapp/unbind-api/internal/repositories/user"
)

// PermissionsRepository handles group and user permissions
//
//go:generate go run -mod=mod github.com/vburenin/ifacemaker -f "*.go" -i PermissionsRepositoryInterface -p permissions_repo -s PermissionsRepository -o permissions_repository_iface.go
type PermissionsRepository struct {
	base            *repository.BaseRepository
	userRepo        user_repo.UserRepositoryInterface
	projectRepo     project_repo.ProjectRepositoryInterface
	environmentRepo environment_repo.EnvironmentRepositoryInterface
	serviceRepo     service_repo.ServiceRepositoryInterface
	teamRepo        team_repo.TeamRepositoryInterface
}

// NewPermissionsRepository creates a new GitHub repository
func NewPermissionsRepository(db *ent.Client, userRepo user_repo.UserRepositoryInterface, projectRepo project_repo.ProjectRepositoryInterface, environmentRepo environment_repo.EnvironmentRepositoryInterface, serviceRepo service_repo.ServiceRepositoryInterface, teamRepo team_repo.TeamRepositoryInterface) *PermissionsRepository {
	return &PermissionsRepository{
		base:            &repository.BaseRepository{DB: db},
		userRepo:        userRepo,
		projectRepo:     projectRepo,
		environmentRepo: environmentRepo,
		serviceRepo:     serviceRepo,
		teamRepo:        teamRepo,
	}
}
