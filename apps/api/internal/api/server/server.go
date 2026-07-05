package server

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/api/apictx"
	"github.com/unbindapp/unbind-api/internal/auth"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/deployctl"
	"github.com/unbindapp/unbind-api/internal/infrastructure/cache"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/infrastructure/updater"
	"github.com/unbindapp/unbind-api/internal/integrations/github"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
	deployments_service "github.com/unbindapp/unbind-api/internal/services/deployments"
	environment_service "github.com/unbindapp/unbind-api/internal/services/environment"
	group_service "github.com/unbindapp/unbind-api/internal/services/group"
	instance_service "github.com/unbindapp/unbind-api/internal/services/instances"
	logs_service "github.com/unbindapp/unbind-api/internal/services/logs"
	metric_service "github.com/unbindapp/unbind-api/internal/services/metrics"
	project_service "github.com/unbindapp/unbind-api/internal/services/project"
	service_service "github.com/unbindapp/unbind-api/internal/services/service"
	servicegroup_service "github.com/unbindapp/unbind-api/internal/services/service_group"
	storage_service "github.com/unbindapp/unbind-api/internal/services/storage"
	system_service "github.com/unbindapp/unbind-api/internal/services/system"
	team_service "github.com/unbindapp/unbind-api/internal/services/team"
	template_service "github.com/unbindapp/unbind-api/internal/services/templates"
	terminal_service "github.com/unbindapp/unbind-api/internal/services/terminal"
	user_service "github.com/unbindapp/unbind-api/internal/services/user"
	variables_service "github.com/unbindapp/unbind-api/internal/services/variables"
	webhooks_service "github.com/unbindapp/unbind-api/internal/services/webooks"
	"github.com/unbindapp/unbind-api/pkg/databases"
)

// EmptyInput can be used when no input is needed.
type EmptyInput struct{}

// BaseAuthInput marks an authenticated endpoint. The token is resolved by the
// auth middleware; handlers read it via GetBearerTokenFromContext.
type BaseAuthInput struct{}

// DeletedResponse is used to return a deleted response.
type DeletedResponse struct {
	ID      string `json:"id"`
	Deleted bool   `json:"deleted"`
}

// SuccessResponse is used for mutations that return no resource.
type SuccessResponse struct {
	Success bool `json:"success"`
}

// Server implements generated.ServerInterface
type Server struct {
	KubeClient           *k8s.KubeClient
	Cfg                  *config.Config
	GithubClient         *github.GithubClient
	Repository           repositories.RepositoriesInterface
	StringCache          *cache.RedisCache[string]
	HttpClient           *http.Client
	DeploymentController *deployctl.DeploymentController
	DatabaseProvider     *databases.DatabaseProvider
	DNSChecker           *utils.DNSChecker
	TokenManager         *auth.TokenManager
	UpdateManager        *updater.Updater
	// Services
	GroupService        *group_service.GroupService
	UserService         *user_service.UserService
	TeamService         *team_service.TeamService
	ProjectService      *project_service.ProjectService
	ServiceService      *service_service.ServiceService
	EnvironmentService  *environment_service.EnvironmentService
	LogService          *logs_service.LogsService
	DeploymentService   *deployments_service.DeploymentService
	SystemService       *system_service.SystemService
	MetricsService      *metric_service.MetricsService
	WebhooksService     *webhooks_service.WebhooksService
	InstanceService     *instance_service.InstanceService
	VariablesService    *variables_service.VariablesService
	StorageService      *storage_service.StorageService
	TemplateService     *template_service.TemplatesService
	ServiceGroupService *servicegroup_service.ServiceGroupService
	TerminalService     *terminal_service.TerminalService
}

func (self *Server) GetUserFromContext(ctx context.Context) (user *ent.User, found bool) {
	user, found = ctx.Value(apictx.UserKey).(*ent.User)
	return user, found
}

// GetBearerTokenFromContext returns the validated access token, used to impersonate
// the user for per-user Kubernetes operations.
func (self *Server) GetBearerTokenFromContext(ctx context.Context) (token string, found bool) {
	token, found = ctx.Value(apictx.BearerTokenKey).(string)
	return token, found
}

// AuthenticatedUser returns the caller and their bearer token from the request
// context. The auth middleware guarantees both are present on authenticated
// routes; a missing user therefore yields a 401.
func (self *Server) AuthenticatedUser(ctx context.Context) (*ent.User, string, error) {
	user, found := self.GetUserFromContext(ctx)
	if !found {
		return nil, "", huma.Error401Unauthorized("Unable to retrieve user")
	}
	token, _ := self.GetBearerTokenFromContext(ctx)
	return user, token, nil
}
