package servicegroup_service

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	"github.com/unbindapp/unbind-api/internal/services"
	service_service "github.com/unbindapp/unbind-api/internal/services/service"
)

// Both summary endpoints copy secret values out of the services' Kubernetes
// secrets, so they follow the same value-visibility rule as GetVariables.
type ValueRedactionSuite struct {
	services.ServiceTestSuite
	service *ServiceGroupService
	userID  uuid.UUID
	input   *models.GetServiceGroupInput
}

func (suite *ValueRedactionSuite) SetupTest() {
	suite.ServiceTestSuite.SetupTest()
	suite.service = &ServiceGroupService{
		repo:           suite.MockRepo,
		k8s:            suite.MockK8s,
		serviceService: service_service.NewServiceService(nil, suite.MockRepo, nil, suite.MockK8s, nil, nil, nil, nil, nil, nil),
	}
	suite.userID = uuid.New()
	suite.input = &models.GetServiceGroupInput{ID: uuid.New(), TeamID: uuid.New(), ProjectID: uuid.New(), EnvironmentID: uuid.New()}
}

func (suite *ValueRedactionSuite) expectGroup(ctx context.Context) {
	template := &ent.Template{ID: uuid.New(), Version: 1, Definition: schema.TemplateDefinition{
		Inputs: []schema.TemplateInput{
			{ID: "input_domain", Name: "Domain", Type: schema.InputTypeHost},
			{ID: "input_secret", Name: "Secret", Type: schema.InputTypeVariable},
		},
		Services: []schema.TemplateService{{ID: "service_backend", Name: "Backend", InputIDs: []string{"input_domain", "input_secret"}}},
	}}
	backend := &ent.Service{ID: uuid.New(), Name: "Backend", TemplateID: &template.ID, TemplateServiceID: new("service_backend"), KubernetesSecret: "sec-backend"}
	backend.Edges.Template = template
	backend.Edges.ServiceConfig = &ent.ServiceConfig{
		Hosts: []schema.HostSpec{{Host: "cloud.example.com", TemplateInputID: new("input_domain")}},
		VariableMetadata: map[string]schema.VariableMetadata{
			"SECRET_VAR": {TemplateInputID: new("input_secret")},
			"ADMIN_KEY":  {DisplayName: "Admin Key"},
		},
	}

	suite.MockEnvironmentRepo.EXPECT().GetByID(ctx, suite.input.EnvironmentID).Return(&ent.Environment{
		ID: suite.input.EnvironmentID,
		Edges: ent.EnvironmentEdges{Project: &ent.Project{
			ID:    suite.input.ProjectID,
			Edges: ent.ProjectEdges{Team: &ent.Team{ID: suite.input.TeamID, Namespace: "team-ns"}},
		}},
	}, nil).Once()
	suite.MockServiceGroupRepo.EXPECT().GetByID(ctx, suite.input.ID).Return(&ent.ServiceGroup{ID: suite.input.ID, EnvironmentID: suite.input.EnvironmentID}, nil).Once()
	suite.MockServiceGroupRepo.EXPECT().GetServicesWithDetails(ctx, suite.input.ID).Return([]*ent.Service{backend}, nil).Once()
	suite.MockK8s.EXPECT().GetInternalClient().Return(nil).Maybe()
	suite.MockK8s.EXPECT().ListPersistentVolumeClaims(ctx, "team-ns", mock.Anything, mock.Anything).Return([]*models.PVCInfo{}, nil).Maybe()
	suite.MockK8s.EXPECT().GetSecretMap(ctx, "sec-backend", "team-ns", mock.Anything).Return(map[string][]byte{"SECRET_VAR": []byte("mysecret"), "ADMIN_KEY": []byte("key123")}, nil).Once()
}

func (suite *ValueRedactionSuite) expectRole(ctx context.Context, editor bool) {
	suite.MockPermissionsRepo.EXPECT().Check(mock.Anything, suite.userID, mock.Anything).RunAndReturn(func(_ context.Context, _ uuid.UUID, checks []permissions_repo.PermissionCheck) error {
		if checks[0].Action == schema.ActionEditor && !editor {
			return errdefs.ErrUnauthorized
		}
		return nil
	})
}

func (suite *ValueRedactionSuite) templateInputValues(resp *models.ServiceGroupTemplateInputsResponse) map[string]string {
	values := map[string]string{}
	for _, in := range resp.Inputs {
		values[in.ID] = in.CurrentValue
	}
	return values
}

func (suite *ValueRedactionSuite) TestTemplateInputsForViewerSession() {
	suite.expectRole(suite.Ctx, false)
	suite.expectGroup(suite.Ctx)

	resp, err := suite.service.GetTemplateInputs(suite.Ctx, suite.userID, suite.input)

	suite.NoError(err)
	suite.True(resp.ValuesRedacted)
	suite.Equal(map[string]string{"input_domain": "cloud.example.com", "input_secret": "", "ADMIN_KEY": ""}, suite.templateInputValues(resp))
}

func (suite *ValueRedactionSuite) TestTemplateInputsForEditorSession() {
	suite.expectRole(suite.Ctx, true)
	suite.expectGroup(suite.Ctx)

	resp, err := suite.service.GetTemplateInputs(suite.Ctx, suite.userID, suite.input)

	suite.NoError(err)
	suite.False(resp.ValuesRedacted)
	suite.Equal(map[string]string{"input_domain": "cloud.example.com", "input_secret": "mysecret", "ADMIN_KEY": "key123"}, suite.templateInputValues(resp))
}

func (suite *ValueRedactionSuite) TestTemplateInputsForKeyWithoutPrivilege() {
	ctx := permissions_repo.WithAPIKeyAccess(suite.Ctx, permissions_repo.APIKeyAccess{Role: schema.ActionEditor, FullAccess: true})
	suite.expectRole(ctx, true)
	suite.expectGroup(ctx)

	resp, err := suite.service.GetTemplateInputs(ctx, suite.userID, suite.input)

	suite.NoError(err)
	suite.True(resp.ValuesRedacted)
	suite.Equal(map[string]string{"input_domain": "cloud.example.com", "input_secret": "", "ADMIN_KEY": ""}, suite.templateInputValues(resp))
}

func (suite *ValueRedactionSuite) groupInfoValues(resp *models.ServiceGroupInfoResponse) map[string]string {
	values := map[string]string{}
	for _, variable := range resp.Services[0].Variables {
		values[variable.Name] = variable.Value
	}
	return values
}

func (suite *ValueRedactionSuite) TestInfoForViewerSession() {
	suite.expectRole(suite.Ctx, false)
	suite.expectGroup(suite.Ctx)

	resp, err := suite.service.GetServiceGroupInfo(suite.Ctx, suite.userID, suite.input)

	suite.NoError(err)
	suite.True(resp.ValuesRedacted)
	suite.Equal(map[string]string{"SECRET_VAR": "", "ADMIN_KEY": ""}, suite.groupInfoValues(resp))
	suite.Equal("cloud.example.com", resp.Services[0].Hosts[0].Host)
}

func (suite *ValueRedactionSuite) TestInfoForEditorSession() {
	suite.expectRole(suite.Ctx, true)
	suite.expectGroup(suite.Ctx)

	resp, err := suite.service.GetServiceGroupInfo(suite.Ctx, suite.userID, suite.input)

	suite.NoError(err)
	suite.False(resp.ValuesRedacted)
	suite.Equal(map[string]string{"SECRET_VAR": "mysecret", "ADMIN_KEY": "key123"}, suite.groupInfoValues(resp))
}

func (suite *ValueRedactionSuite) TestInfoForKeyWithoutPrivilege() {
	ctx := permissions_repo.WithAPIKeyAccess(suite.Ctx, permissions_repo.APIKeyAccess{Role: schema.ActionEditor, FullAccess: true})
	suite.expectRole(ctx, true)
	suite.expectGroup(ctx)

	resp, err := suite.service.GetServiceGroupInfo(ctx, suite.userID, suite.input)

	suite.NoError(err)
	suite.True(resp.ValuesRedacted)
	suite.Equal(map[string]string{"SECRET_VAR": "", "ADMIN_KEY": ""}, suite.groupInfoValues(resp))
}

func TestValueRedactionSuite(t *testing.T) {
	suite.Run(t, new(ValueRedactionSuite))
}
