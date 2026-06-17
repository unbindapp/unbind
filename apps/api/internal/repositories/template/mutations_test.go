package template_repo

import (
	"testing"

	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent/template"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

type TemplateMutationsSuite struct {
	repository.RepositoryBaseSuite
	templateRepo *TemplateRepository
}

func (suite *TemplateMutationsSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.templateRepo = NewTemplateRepository(suite.DB)
}

func (suite *TemplateMutationsSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.templateRepo = nil
}

func (suite *TemplateMutationsSuite) TestUpsertPredefinedTemplates() {
	suite.Run("Upsert Success", func() {
		err := suite.templateRepo.UpsertPredefinedTemplates(suite.Ctx)
		suite.NoError(err)

		// Verify templates were created
		templates, err := suite.DB.Template.Query().
			Where(template.ImmutableEQ(true)).
			All(suite.Ctx)
		suite.NoError(err)
		suite.Greater(len(templates), 0)

		// Verify template properties
		for _, tmpl := range templates {
			suite.True(tmpl.Immutable)
			suite.NotEmpty(tmpl.Name)
			suite.NotEmpty(tmpl.Description)
			suite.Greater(tmpl.Version, 0)
		}
	})

	suite.Run("Upsert Idempotent", func() {
		// First upsert
		err := suite.templateRepo.UpsertPredefinedTemplates(suite.Ctx)
		suite.NoError(err)

		count1, err := suite.DB.Template.Query().Count(suite.Ctx)
		suite.NoError(err)

		// Second upsert should not create duplicates
		err = suite.templateRepo.UpsertPredefinedTemplates(suite.Ctx)
		suite.NoError(err)

		count2, err := suite.DB.Template.Query().Count(suite.Ctx)
		suite.NoError(err)

		suite.Equal(count1, count2)
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		err := suite.templateRepo.UpsertPredefinedTemplates(suite.Ctx)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func TestTemplateMutationsSuite(t *testing.T) {
	suite.Run(t, new(TemplateMutationsSuite))
}
