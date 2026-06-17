package template_repo

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

type TemplateQueriesSuite struct {
	repository.RepositoryBaseSuite
	templateRepo *TemplateRepository
	testTemplate *ent.Template
}

func (suite *TemplateQueriesSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.templateRepo = NewTemplateRepository(suite.DB)

	// Create test template
	suite.testTemplate = suite.DB.Template.Create().
		SetName("Test Template").
		SetDescription("Test template description").
		SetIcon("test-icon").
		SetKeywords([]string{"test", "template"}).
		SetResourceRecommendations(schema.TemplateResourceRecommendations{
			MinimumCPUs:  0.5,
			MinimumRAMGB: 1.0,
		}).
		SetDisplayRank(1).
		SetVersion(1).
		SetDefinition(schema.TemplateDefinition{
			Name:        "Test Template",
			Description: "Test template description",
			Version:     1,
			Services:    []schema.TemplateService{},
			Inputs:      []schema.TemplateInput{},
		}).
		SaveX(suite.Ctx)
}

func (suite *TemplateQueriesSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.templateRepo = nil
	suite.testTemplate = nil
}

func (suite *TemplateQueriesSuite) TestGetByID() {
	suite.Run("Get By ID Success", func() {
		template, err := suite.templateRepo.GetByID(suite.Ctx, suite.testTemplate.ID)
		suite.NoError(err)
		suite.NotNil(template)
		suite.Equal(suite.testTemplate.ID, template.ID)
		suite.Equal("Test Template", template.Name)
	})

	suite.Run("Get Non-existent Template", func() {
		_, err := suite.templateRepo.GetByID(suite.Ctx, uuid.New())
		suite.Error(err)
		suite.True(ent.IsNotFound(err))
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.templateRepo.GetByID(suite.Ctx, suite.testTemplate.ID)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *TemplateQueriesSuite) TestGetAll() {
	suite.Run("Get All Templates", func() {
		templates, err := suite.templateRepo.GetAll(suite.Ctx)
		suite.NoError(err)
		suite.GreaterOrEqual(len(templates), 1)

		// Find our test template
		var foundTemplate *ent.Template
		for _, tmpl := range templates {
			if tmpl.ID == suite.testTemplate.ID {
				foundTemplate = tmpl
				break
			}
		}
		suite.NotNil(foundTemplate)
		suite.Equal("Test Template", foundTemplate.Name)
	})

	suite.Run("Get All With Multiple Versions", func() {
		// Create newer version of same template
		suite.DB.Template.Create().
			SetName("Test Template").
			SetDescription("Updated description").
			SetIcon("test-icon").
			SetDisplayRank(1).
			SetVersion(2).
			SetResourceRecommendations(
				schema.TemplateResourceRecommendations{
					MinimumCPUs:  0.5,
					MinimumRAMGB: 1.0,
				},
			).
			SetDefinition(schema.TemplateDefinition{
				Name:        "Test Template",
				Description: "Updated description",
				Version:     2,
				Services:    []schema.TemplateService{},
				Inputs:      []schema.TemplateInput{},
			}).
			SaveX(suite.Ctx)

		templates, err := suite.templateRepo.GetAll(suite.Ctx)
		suite.NoError(err)

		// Should only return the newest version
		testTemplateCount := 0
		var testTemplate *ent.Template
		for _, tmpl := range templates {
			if tmpl.Name == "Test Template" {
				testTemplateCount++
				testTemplate = tmpl
			}
		}
		suite.Equal(1, testTemplateCount)
		suite.Equal(2, testTemplate.Version) // Should be the newer version
	})

	suite.Run("Get All With Sorting", func() {
		// Create templates with different display ranks
		suite.DB.Template.Create().
			SetName("A Template").
			SetDescription("A template").
			SetIcon("a-icon").
			SetDisplayRank(3).
			SetVersion(1).
			SetResourceRecommendations(
				schema.TemplateResourceRecommendations{
					MinimumCPUs:  0.5,
					MinimumRAMGB: 1.0,
				},
			).
			SetDefinition(schema.TemplateDefinition{
				Name:        "A Template",
				Description: "A template",
				Version:     1,
				Services:    []schema.TemplateService{},
				Inputs:      []schema.TemplateInput{},
			}).
			SaveX(suite.Ctx)

		suite.DB.Template.Create().
			SetName("B Template").
			SetDescription("B template").
			SetIcon("b-icon").
			SetDisplayRank(2).
			SetVersion(1).
			SetResourceRecommendations(
				schema.TemplateResourceRecommendations{
					MinimumCPUs:  0.5,
					MinimumRAMGB: 1.0,
				},
			).
			SetDefinition(schema.TemplateDefinition{
				Name:        "B Template",
				Description: "B template",
				Version:     1,
				Services:    []schema.TemplateService{},
				Inputs:      []schema.TemplateInput{},
			}).
			SaveX(suite.Ctx)

		templates, err := suite.templateRepo.GetAll(suite.Ctx)
		suite.NoError(err)
		suite.GreaterOrEqual(len(templates), 3)

		// Verify sorting: lower rank first, then alphabetical
		for i := 0; i < len(templates)-1; i++ {
			if templates[i].DisplayRank == templates[i+1].DisplayRank {
				// Same rank, should be alphabetical
				suite.LessOrEqual(templates[i].Name, templates[i+1].Name)
			} else {
				// Different rank, lower should come first
				suite.Less(templates[i].DisplayRank, templates[i+1].DisplayRank)
			}
		}
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.templateRepo.GetAll(suite.Ctx)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func TestTemplateQueriesSuite(t *testing.T) {
	suite.Run(t, new(TemplateQueriesSuite))
}
