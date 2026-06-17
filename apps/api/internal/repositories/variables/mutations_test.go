package variable_repo

import (
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/ent/variablereference"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	"golang.org/x/crypto/bcrypt"
)

type VariableMutationsSuite struct {
	repository.RepositoryBaseSuite
	variableRepo    *VariableRepository
	testUser        *ent.User
	testTeam        *ent.Team
	testProject     *ent.Project
	testEnvironment *ent.Environment
	testService     *ent.Service
}

func (suite *VariableMutationsSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.variableRepo = NewVariableRepository(suite.DB)

	// Create test user
	pwd, _ := bcrypt.GenerateFromPassword([]byte("test-password"), 1)
	suite.testUser = suite.DB.User.Create().
		SetEmail("test@example.com").
		SetPasswordHash(string(pwd)).
		SaveX(suite.Ctx)

	// Create test team
	suite.testTeam = suite.DB.Team.Create().
		SetKubernetesName("test-team").
		SetName("Test Team").
		SetNamespace("test-namespace").
		SetKubernetesSecret("test-k8s-secret").
		AddMemberIDs(suite.testUser.ID).
		SaveX(suite.Ctx)

	// Create test project
	suite.testProject = suite.DB.Project.Create().
		SetKubernetesName("test-project").
		SetName("Test Project").
		SetTeamID(suite.testTeam.ID).
		SetKubernetesSecret("test-project-secret").
		SaveX(suite.Ctx)

	// Create test environment
	suite.testEnvironment = suite.DB.Environment.Create().
		SetKubernetesName("test-env").
		SetName("Test Environment").
		SetProjectID(suite.testProject.ID).
		SetKubernetesSecret("test-env-secret").
		SaveX(suite.Ctx)

	// Create test service
	suite.testService = suite.DB.Service.Create().
		SetType(schema.ServiceTypeGithub).
		SetKubernetesName("test-service").
		SetName("Test Service").
		SetEnvironmentID(suite.testEnvironment.ID).
		SetKubernetesSecret("test-service-secret").
		SaveX(suite.Ctx)
}

func (suite *VariableMutationsSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.variableRepo = nil
	suite.testUser = nil
	suite.testTeam = nil
	suite.testProject = nil
	suite.testEnvironment = nil
	suite.testService = nil
}

func (suite *VariableMutationsSuite) TestUpdateReferences() {
	suite.Run("Update Overwrite Behavior", func() {
		// Clean up any existing references
		suite.DB.VariableReference.Delete().
			Where(variablereference.TargetServiceIDEQ(suite.testService.ID)).
			ExecX(suite.Ctx)

		// Create existing reference
		suite.DB.VariableReference.Create().
			SetTargetServiceID(suite.testService.ID).
			SetTargetName("OLD_VAR").
			SetSources([]schema.VariableReferenceSource{
				{
					Type:                 schema.VariableReferenceTypeVariable,
					SourceName:           "old-source",
					SourceIcon:           "service",
					SourceType:           schema.VariableReferenceSourceTypeService,
					SourceID:             suite.testService.ID,
					SourceKubernetesName: "old-source",
					Key:                  "old-key",
				},
			}).
			SetValueTemplate("old-value").
			SaveX(suite.Ctx)

		items := []*models.VariableReferenceInputItem{
			{
				Name: "DATABASE_URL",
				Sources: []schema.VariableReferenceSource{
					{
						Type:                 schema.VariableReferenceTypeVariable,
						SourceName:           "db-service",
						SourceIcon:           "service",
						SourceType:           schema.VariableReferenceSourceTypeService,
						SourceID:             suite.testService.ID,
						SourceKubernetesName: "db-service",
						Key:                  "connection",
					},
				},
				Value: "postgres://user:pass@host:5432/db",
			},
			{
				Name: "API_KEY",
				Sources: []schema.VariableReferenceSource{
					{
						Type:                 schema.VariableReferenceTypeVariable,
						SourceName:           "config",
						SourceIcon:           "service",
						SourceType:           schema.VariableReferenceSourceTypeService,
						SourceID:             suite.testService.ID,
						SourceKubernetesName: "config",
						Key:                  "api-key",
					},
				},
				Value: "secret-key",
			},
		}

		refs, err := suite.variableRepo.UpdateReferences(
			suite.Ctx, nil,
			models.VariableUpdateBehaviorOverwrite,
			suite.testService.ID,
			items,
		)

		suite.NoError(err)
		suite.Len(refs, 2)

		// Verify old reference was deleted
		count, err := suite.DB.VariableReference.Query().
			Where(variablereference.TargetServiceIDEQ(suite.testService.ID)).
			Count(suite.Ctx)
		suite.NoError(err)
		suite.Equal(2, count)
	})

	suite.Run("Update Upsert Behavior", func() {
		// Clean up any existing references
		suite.DB.VariableReference.Delete().
			Where(variablereference.TargetServiceIDEQ(suite.testService.ID)).
			ExecX(suite.Ctx)

		// Create existing reference
		existing := suite.DB.VariableReference.Create().
			SetTargetServiceID(suite.testService.ID).
			SetTargetName("DATABASE_URL").
			SetSources([]schema.VariableReferenceSource{
				{
					Type:                 schema.VariableReferenceTypeVariable,
					SourceName:           "old-db",
					SourceIcon:           "service",
					SourceType:           schema.VariableReferenceSourceTypeService,
					SourceID:             suite.testService.ID,
					SourceKubernetesName: "old-db",
					Key:                  "connection",
				},
			}).
			SetValueTemplate("old-connection").
			SaveX(suite.Ctx)

		items := []*models.VariableReferenceInputItem{
			{
				Name: "DATABASE_URL", // Same name, should update
				Sources: []schema.VariableReferenceSource{
					{
						Type:                 schema.VariableReferenceTypeVariable,
						SourceName:           "new-db",
						SourceIcon:           "service",
						SourceType:           schema.VariableReferenceSourceTypeService,
						SourceID:             suite.testService.ID,
						SourceKubernetesName: "new-db",
						Key:                  "connection",
					},
				},
				Value: "new-connection",
			},
			{
				Name: "NEW_VAR",
				Sources: []schema.VariableReferenceSource{
					{
						Type:                 schema.VariableReferenceTypeVariable,
						SourceName:           "source",
						SourceIcon:           "service",
						SourceType:           schema.VariableReferenceSourceTypeService,
						SourceID:             suite.testService.ID,
						SourceKubernetesName: "source",
						Key:                  "value",
					},
				},
				Value: "value",
			},
		}

		refs, err := suite.variableRepo.UpdateReferences(
			suite.Ctx, nil,
			models.VariableUpdateBehaviorUpsert,
			suite.testService.ID,
			items,
		)

		suite.NoError(err)
		suite.Len(refs, 2)

		// Verify existing was updated
		updated, err := suite.DB.VariableReference.Get(suite.Ctx, existing.ID)
		suite.NoError(err)
		suite.Equal("new-connection", updated.ValueTemplate)
	})

	suite.Run("Trim Whitespace", func() {
		// Clean up any existing references
		suite.DB.VariableReference.Delete().
			Where(variablereference.TargetServiceIDEQ(suite.testService.ID)).
			ExecX(suite.Ctx)

		items := []*models.VariableReferenceInputItem{
			{
				Name: "  TRIMMED_VAR  ",
				Sources: []schema.VariableReferenceSource{
					{
						Type:                 schema.VariableReferenceTypeVariable,
						SourceName:           "source",
						SourceIcon:           "service",
						SourceType:           schema.VariableReferenceSourceTypeService,
						SourceID:             suite.testService.ID,
						SourceKubernetesName: "source",
						Key:                  "value",
					},
				},
				Value: "value",
			},
		}

		refs, err := suite.variableRepo.UpdateReferences(
			suite.Ctx, nil,
			models.VariableUpdateBehaviorOverwrite,
			suite.testService.ID,
			items,
		)

		suite.NoError(err)
		suite.Len(refs, 1)
		suite.Equal("TRIMMED_VAR", refs[0].TargetName)
	})

	suite.Run("Error when DB closed", func() {
		// Clean up any existing references
		suite.DB.VariableReference.Delete().
			Where(variablereference.TargetServiceIDEQ(suite.testService.ID)).
			ExecX(suite.Ctx)

		items := []*models.VariableReferenceInputItem{
			{
				Name: "VAR",
				Sources: []schema.VariableReferenceSource{
					{
						Type:                 schema.VariableReferenceTypeVariable,
						SourceName:           "source",
						SourceIcon:           "service",
						SourceType:           schema.VariableReferenceSourceTypeService,
						SourceID:             suite.testService.ID,
						SourceKubernetesName: "source",
						Key:                  "value",
					},
				},
				Value: "value",
			},
		}

		suite.DB.Close()
		_, err := suite.variableRepo.UpdateReferences(
			suite.Ctx, nil,
			models.VariableUpdateBehaviorOverwrite,
			suite.testService.ID,
			items,
		)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *VariableMutationsSuite) TestAttachError() {
	suite.Run("Attach Error Success", func() {
		ref := suite.DB.VariableReference.Create().
			SetTargetServiceID(suite.testService.ID).
			SetTargetName("ERROR_VAR").
			SetSources([]schema.VariableReferenceSource{
				{
					Type:                 schema.VariableReferenceTypeVariable,
					SourceName:           "source",
					SourceIcon:           "service",
					SourceType:           schema.VariableReferenceSourceTypeService,
					SourceID:             suite.testService.ID,
					SourceKubernetesName: "source",
					Key:                  "value",
				},
			}).
			SetValueTemplate("value").
			SaveX(suite.Ctx)

		testErr := errors.New("test error message")
		updated, err := suite.variableRepo.AttachError(suite.Ctx, ref.ID, testErr)

		suite.NoError(err)
		suite.NotNil(updated)
		suite.NotNil(updated.Error)
		suite.Equal("test error message", *updated.Error)
	})

	suite.Run("Attach Error Non-existent Reference", func() {
		testErr := errors.New("test error")
		_, err := suite.variableRepo.AttachError(suite.Ctx, uuid.New(), testErr)
		suite.Error(err)
		suite.True(ent.IsNotFound(err))
	})

	suite.Run("Error when DB closed", func() {
		testErr := errors.New("test error")
		suite.DB.Close()
		_, err := suite.variableRepo.AttachError(suite.Ctx, uuid.New(), testErr)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *VariableMutationsSuite) TestClearError() {
	suite.Run("Clear Error Success", func() {
		ref := suite.DB.VariableReference.Create().
			SetTargetServiceID(suite.testService.ID).
			SetTargetName("CLEAR_VAR").
			SetSources([]schema.VariableReferenceSource{
				{
					Type:                 schema.VariableReferenceTypeVariable,
					SourceName:           "source",
					SourceIcon:           "service",
					SourceType:           schema.VariableReferenceSourceTypeService,
					SourceID:             suite.testService.ID,
					SourceKubernetesName: "source",
					Key:                  "value",
				},
			}).
			SetValueTemplate("value").
			SetError("existing error").
			SaveX(suite.Ctx)

		updated, err := suite.variableRepo.ClearError(suite.Ctx, ref.ID)

		suite.NoError(err)
		suite.NotNil(updated)
		suite.Nil(updated.Error)
	})

	suite.Run("Clear Error Non-existent Reference", func() {
		_, err := suite.variableRepo.ClearError(suite.Ctx, uuid.New())
		suite.Error(err)
		suite.True(ent.IsNotFound(err))
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.variableRepo.ClearError(suite.Ctx, uuid.New())
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *VariableMutationsSuite) TestDeleteReferences() {
	suite.Run("Delete References Success", func() {
		// Create references
		ref1 := suite.DB.VariableReference.Create().
			SetTargetServiceID(suite.testService.ID).
			SetTargetName("VAR1").
			SetSources([]schema.VariableReferenceSource{
				{
					Type:                 schema.VariableReferenceTypeVariable,
					SourceName:           "source1",
					SourceIcon:           "service",
					SourceType:           schema.VariableReferenceSourceTypeService,
					SourceID:             suite.testService.ID,
					SourceKubernetesName: "source1",
					Key:                  "value1",
				},
			}).
			SetValueTemplate("value1").
			SaveX(suite.Ctx)

		ref2 := suite.DB.VariableReference.Create().
			SetTargetServiceID(suite.testService.ID).
			SetTargetName("VAR2").
			SetSources([]schema.VariableReferenceSource{
				{
					Type:                 schema.VariableReferenceTypeVariable,
					SourceName:           "source2",
					SourceIcon:           "service",
					SourceType:           schema.VariableReferenceSourceTypeService,
					SourceID:             suite.testService.ID,
					SourceKubernetesName: "source2",
					Key:                  "value2",
				},
			}).
			SetValueTemplate("value2").
			SaveX(suite.Ctx)

		// Create reference for different service (should not be deleted)
		otherService := suite.DB.Service.Create().
			SetType(schema.ServiceTypeGithub).
			SetKubernetesName("other-service").
			SetName("Other Service").
			SetEnvironmentID(suite.testEnvironment.ID).
			SetKubernetesSecret("other-service-secret").
			SaveX(suite.Ctx)

		otherRef := suite.DB.VariableReference.Create().
			SetTargetServiceID(otherService.ID).
			SetTargetName("OTHER_VAR").
			SetSources([]schema.VariableReferenceSource{
				{
					Type:                 schema.VariableReferenceTypeVariable,
					SourceName:           "source",
					SourceIcon:           "service",
					SourceType:           schema.VariableReferenceSourceTypeService,
					SourceID:             otherService.ID,
					SourceKubernetesName: "source",
					Key:                  "value",
				},
			}).
			SetValueTemplate("value").
			SaveX(suite.Ctx)

		count, err := suite.variableRepo.DeleteReferences(
			suite.Ctx, nil,
			suite.testService.ID,
			[]uuid.UUID{ref1.ID, ref2.ID},
		)

		suite.NoError(err)
		suite.Equal(2, count)

		// Verify deletions
		_, err = suite.DB.VariableReference.Get(suite.Ctx, ref1.ID)
		suite.Error(err)
		suite.True(ent.IsNotFound(err))

		_, err = suite.DB.VariableReference.Get(suite.Ctx, ref2.ID)
		suite.Error(err)
		suite.True(ent.IsNotFound(err))

		// Verify other service reference still exists
		_, err = suite.DB.VariableReference.Get(suite.Ctx, otherRef.ID)
		suite.NoError(err)
	})

	suite.Run("Delete No Matching References", func() {
		count, err := suite.variableRepo.DeleteReferences(
			suite.Ctx, nil,
			suite.testService.ID,
			[]uuid.UUID{uuid.New(), uuid.New()},
		)

		suite.NoError(err)
		suite.Equal(0, count)
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.variableRepo.DeleteReferences(
			suite.Ctx, nil,
			suite.testService.ID,
			[]uuid.UUID{uuid.New()},
		)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func TestVariableMutationsSuite(t *testing.T) {
	suite.Run(t, new(VariableMutationsSuite))
}
