package repository

import (
	"context"

	_ "github.com/ncruces/go-sqlite3/driver"
	_ "github.com/ncruces/go-sqlite3/embed"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/enttest"
)

type RepositoryBaseSuite struct {
	suite.Suite
	Ctx context.Context
	DB  *ent.Client
}

func (suite *RepositoryBaseSuite) SetupTest() {
	suite.Ctx = context.Background()
	suite.DB = enttest.Open(suite.T(), "sqlite3", "file:ent?mode=memory&_fk=1")
	err := suite.DB.Schema.Create(suite.Ctx)
	if err != nil {
		suite.T().Fatalf("failed creating schema resources: %v", err)
	}
}

func (suite *RepositoryBaseSuite) TearDownTest() {
	if err := suite.DB.Close(); err != nil {
		suite.T().Fatalf("failed closing database connection: %v", err)
	}
	suite.DB = nil
}
