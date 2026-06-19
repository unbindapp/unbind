package terminal_service

import (
	"context"

	"github.com/google/uuid"
	corev1 "k8s.io/api/core/v1"

	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
)

// RequiredAction gates opening a terminal. Editor for now; raise to admin here, or
// fine-tune via the permission APIs, without other changes.
const RequiredAction = schema.ActionEditor

// Shorten bash terminal prompts to just CWD, truncated to 2 levels.
var defaultShellCommand = []string{"/bin/sh", "-c", `
export PROMPT_DIRTRIM=2
export PROMPT_COMMAND='PS1='\''\w\$ '\'''
if command -v bash >/dev/null 2>&1; then exec bash -i; fi
export PS1='$PWD$ '
exec sh -i
`}

type TerminalService struct {
	repo repositories.RepositoriesInterface
	k8s  k8s.KubeClientInterface
}

func NewTerminalService(repo repositories.RepositoriesInterface, k8sClient k8s.KubeClientInterface) *TerminalService {
	return &TerminalService{
		repo: repo,
		k8s:  k8sClient,
	}
}

type ExecInput struct {
	TeamID        uuid.UUID
	ProjectID     uuid.UUID
	EnvironmentID uuid.UUID
	ServiceID     uuid.UUID
	PodName       string
	Container     string
}

type ExecTarget struct {
	Namespace string
	PodName   string
	Container string
	Command   []string
}

// Resolve authorizes the request and picks the target pod/container. Runs before the
// websocket upgrade so denials surface as normal HTTP errors.
func (self *TerminalService) Resolve(ctx context.Context, requesterUserID uuid.UUID, bearerToken string, input *ExecInput) (*ExecTarget, error) {
	team, service, err := self.validatePermissionsAndParseInputs(ctx, requesterUserID, input)
	if err != nil {
		return nil, err
	}

	client, err := self.k8s.CreateClientWithToken(bearerToken)
	if err != nil {
		return nil, err
	}

	pods, err := self.k8s.GetPodsByLabels(ctx, team.Namespace, map[string]string{"unbind-service": service.ID.String()}, client)
	if err != nil {
		return nil, err
	}
	if pods == nil || len(pods.Items) == 0 {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "No running pods found for this service")
	}

	pod, err := selectPod(pods.Items, input.PodName)
	if err != nil {
		return nil, err
	}

	container, err := selectContainer(pod, input.Container)
	if err != nil {
		return nil, err
	}

	return &ExecTarget{
		Namespace: team.Namespace,
		PodName:   pod.Name,
		Container: container,
		Command:   defaultShellCommand,
	}, nil
}

func selectPod(pods []corev1.Pod, requested string) (*corev1.Pod, error) {
	if requested != "" {
		for i := range pods {
			if pods[i].Name == requested {
				return &pods[i], nil
			}
		}
		return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Requested pod not found for this service")
	}

	for i := range pods {
		if pods[i].Status.Phase == corev1.PodRunning {
			return &pods[i], nil
		}
	}
	return &pods[0], nil
}

func selectContainer(pod *corev1.Pod, requested string) (string, error) {
	if len(pod.Spec.Containers) == 0 {
		return "", errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Pod has no containers")
	}

	if requested == "" {
		return pod.Spec.Containers[0].Name, nil
	}

	for _, c := range pod.Spec.Containers {
		if c.Name == requested {
			return requested, nil
		}
	}
	return "", errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Requested container not found in pod")
}

func (self *TerminalService) validatePermissionsAndParseInputs(ctx context.Context, requesterUserID uuid.UUID, input *ExecInput) (*ent.Team, *ent.Service, error) {
	// Check resolves hierarchy and implied actions, so a parent-scope admin/editor passes too.
	checks := []permissions_repo.PermissionCheck{
		{
			Action:       RequiredAction,
			ResourceType: schema.ResourceTypeService,
			ResourceID:   input.ServiceID,
		},
	}
	if err := self.repo.Permissions().Check(ctx, requesterUserID, checks); err != nil {
		return nil, nil, err
	}

	team, err := self.repo.Team().GetByID(ctx, input.TeamID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Team not found")
		}
		return nil, nil, err
	}

	project, err := self.repo.Project().GetByID(ctx, input.ProjectID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Project not found")
		}
		return nil, nil, err
	}
	if project.TeamID != input.TeamID {
		return nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Project not found in this team")
	}

	environment, err := self.repo.Environment().GetByID(ctx, input.EnvironmentID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Environment not found")
		}
		return nil, nil, err
	}
	if environment.ProjectID != input.ProjectID {
		return nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Environment not found in this project")
	}

	service, err := self.repo.Service().GetByID(ctx, input.ServiceID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Service not found")
		}
		return nil, nil, err
	}
	if service.EnvironmentID != input.EnvironmentID {
		return nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Service not found in this environment")
	}

	return team, service, nil
}
