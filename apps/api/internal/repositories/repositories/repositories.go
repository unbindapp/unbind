package repositories

import (
	"context"

	"github.com/unbindapp/unbind-api/ent"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	bootstrap_repo "github.com/unbindapp/unbind-api/internal/repositories/bootstrap"
	deployment_repo "github.com/unbindapp/unbind-api/internal/repositories/deployment"
	environment_repo "github.com/unbindapp/unbind-api/internal/repositories/environment"
	github_repo "github.com/unbindapp/unbind-api/internal/repositories/github"
	group_repo "github.com/unbindapp/unbind-api/internal/repositories/group"
	oauth_repo "github.com/unbindapp/unbind-api/internal/repositories/oauth"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	project_repo "github.com/unbindapp/unbind-api/internal/repositories/project"
	s3_repo "github.com/unbindapp/unbind-api/internal/repositories/s3"
	service_repo "github.com/unbindapp/unbind-api/internal/repositories/service"
	servicegroup_repo "github.com/unbindapp/unbind-api/internal/repositories/service_group"
	system_repo "github.com/unbindapp/unbind-api/internal/repositories/system"
	team_repo "github.com/unbindapp/unbind-api/internal/repositories/team"
	template_repo "github.com/unbindapp/unbind-api/internal/repositories/template"
	user_repo "github.com/unbindapp/unbind-api/internal/repositories/user"
	variable_repo "github.com/unbindapp/unbind-api/internal/repositories/variables"
	webhook_repo "github.com/unbindapp/unbind-api/internal/repositories/webhook"
)

// Repositories provides access to all repositories
//
//go:generate go run -mod=mod github.com/vburenin/ifacemaker -f "*.go" -i RepositoriesInterface -p repositories -s Repositories -o repositories_iface.go
type Repositories struct {
	db           *ent.Client
	base         *repository.BaseRepository
	github       github_repo.GithubRepositoryInterface
	user         user_repo.UserRepositoryInterface
	oauth        oauth_repo.OauthRepositoryInterface
	group        group_repo.GroupRepositoryInterface
	project      project_repo.ProjectRepositoryInterface
	team         team_repo.TeamRepositoryInterface
	permissions  permissions_repo.PermissionsRepositoryInterface
	environment  environment_repo.EnvironmentRepositoryInterface
	service      service_repo.ServiceRepositoryInterface
	deployment   deployment_repo.DeploymentRepositoryInterface
	system       system_repo.SystemRepositoryInterface
	webhooks     webhook_repo.WebhookRepositoryInterface
	variables    variable_repo.VariableRepositoryInterface
	bootstrap    bootstrap_repo.BootstrapRepositoryInterface
	s3           s3_repo.S3RepositoryInterface
	template     template_repo.TemplateRepositoryInterface
	serviceGroup servicegroup_repo.ServiceGroupRepositoryInterface
}

// NewRepositories creates a new Repositories facade
func NewRepositories(db *ent.Client) *Repositories {
	base := repository.NewBaseRepository(db)
	githubRepo := github_repo.NewGithubRepository(db)
	oauthRepo := oauth_repo.NewOauthRepository(db)
	userRepo := user_repo.NewUserRepository(db)
	projectRepo := project_repo.NewProjectRepository(db)
	teamRepo := team_repo.NewTeamRepository(db)
	environmentRepo := environment_repo.NewEnvironmentRepository(db)
	deploymentRepo := deployment_repo.NewDeploymentRepository(db)
	serviceRepo := service_repo.NewServiceRepository(db, deploymentRepo)
	permissionsRepo := permissions_repo.NewPermissionsRepository(db, userRepo, projectRepo, environmentRepo, serviceRepo, teamRepo)
	groupRepo := group_repo.NewGroupRepository(db, permissionsRepo)
	systemRepo := system_repo.NewSystemRepository(db)
	webhooksRepo := webhook_repo.NewWebhookRepository(db)
	variablesRepo := variable_repo.NewVariableRepository(db)
	bootstrapRepo := bootstrap_repo.NewBootstrapRepository(db)
	s3Repo := s3_repo.NewS3Repository(db)
	templateRepo := template_repo.NewTemplateRepository(db)
	serviceGroupRepo := servicegroup_repo.NewServiceGroupRepository(db)
	return &Repositories{
		db:           db,
		base:         base,
		github:       githubRepo,
		user:         userRepo,
		oauth:        oauthRepo,
		group:        groupRepo,
		project:      projectRepo,
		team:         teamRepo,
		permissions:  permissionsRepo,
		environment:  environmentRepo,
		service:      serviceRepo,
		deployment:   deploymentRepo,
		system:       systemRepo,
		webhooks:     webhooksRepo,
		variables:    variablesRepo,
		bootstrap:    bootstrapRepo,
		s3:           s3Repo,
		template:     templateRepo,
		serviceGroup: serviceGroupRepo,
	}
}

// Ent() returns the ent client
func (r *Repositories) Ent() *ent.Client {
	return r.db
}

// Github returns the GitHub repository
func (r *Repositories) Github() github_repo.GithubRepositoryInterface {
	return r.github
}

// User returns the User repository
func (r *Repositories) User() user_repo.UserRepositoryInterface {
	return r.user
}

// Oauth returns the OAuth repository
func (r *Repositories) Oauth() oauth_repo.OauthRepositoryInterface {
	return r.oauth
}

// Group returns the Group repository
func (r *Repositories) Group() group_repo.GroupRepositoryInterface {
	return r.group
}

// Project returns the Project repository
func (r *Repositories) Project() project_repo.ProjectRepositoryInterface {
	return r.project
}

// Team returns the Team repository
func (r *Repositories) Team() team_repo.TeamRepositoryInterface {
	return r.team
}

// Permissions returns the Permissions repository
func (r *Repositories) Permissions() permissions_repo.PermissionsRepositoryInterface {
	return r.permissions
}

// Environment returns the Environment repository
func (r *Repositories) Environment() environment_repo.EnvironmentRepositoryInterface {
	return r.environment
}

// Service returns the Service repository
func (r *Repositories) Service() service_repo.ServiceRepositoryInterface {
	return r.service
}

// Deployment returns the Deployment repository
func (r *Repositories) Deployment() deployment_repo.DeploymentRepositoryInterface {
	return r.deployment
}

// System returns the System repository
func (r *Repositories) System() system_repo.SystemRepositoryInterface {
	return r.system
}

// Webhooks returns the Webhook repository
func (r *Repositories) Webhooks() webhook_repo.WebhookRepositoryInterface {
	return r.webhooks
}

// Variables returns the Variable repository
func (r *Repositories) Variables() variable_repo.VariableRepositoryInterface {
	return r.variables
}

// Bootstrap returns the Bootstrap repository
func (r *Repositories) Bootstrap() bootstrap_repo.BootstrapRepositoryInterface {
	return r.bootstrap
}

// S3 returns the S3 repository
func (r *Repositories) S3() s3_repo.S3RepositoryInterface {
	return r.s3
}

// Template returns the Template repository
func (r *Repositories) Template() template_repo.TemplateRepositoryInterface {
	return r.template
}

func (r *Repositories) ServiceGroup() servicegroup_repo.ServiceGroupRepositoryInterface {
	return r.serviceGroup
}

func (r *Repositories) WithTx(ctx context.Context, fn func(tx repository.TxInterface) error) error {
	return r.base.WithTx(ctx, fn)
}
