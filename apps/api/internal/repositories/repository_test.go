package repository

import (
	"context"
	dbSql "database/sql"
	"errors"
	"testing"

	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/sql"
	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	mockRepoTx "github.com/unbindapp/unbind-api/mocks/repository/tx"
)

type RepositorySuite struct {
	suite.Suite
	repo   BaseRepositoryInterface
	ctx    context.Context
	mockDb *dbSql.DB
	db     *ent.Client
	dbMock sqlmock.Sqlmock
	txMock *mockRepoTx.TxMock
}

func (suite *RepositorySuite) SetupTest() {
	suite.ctx = context.Background()

	db, mock, err := sqlmock.New()
	if err != nil {
		suite.T().Fatalf("an error '%s' was not expected when opening a stub database connection", err)
	}
	driver := sql.OpenDB(dialect.Postgres, db)
	driverOption := ent.Driver(driver)
	suite.dbMock = mock
	suite.mockDb = db
	suite.db = ent.NewClient(driverOption)
	suite.repo = NewBaseRepository(suite.db)
	suite.txMock = new(mockRepoTx.TxMock)
}

func (suite *RepositorySuite) TearDownTest() {
	suite.db.Close()
	suite.mockDb.Close()
	suite.repo = nil
}

func (suite *RepositorySuite) TestWithTx() {
	suite.Run("WithTx Success", func() {
		suite.dbMock.ExpectBegin()
		suite.dbMock.ExpectCommit()

		err := suite.repo.WithTx(context.TODO(), func(_ TxInterface) error {
			return nil
		})

		suite.NoError(err)

		if err := suite.dbMock.ExpectationsWereMet(); err != nil {
			suite.T().Errorf("there were unfulfilled expectations: %s", err)
		}
	})

	suite.Run("Commit error", func() {
		suite.dbMock.ExpectBegin()
		suite.dbMock.ExpectCommit().WillReturnError(errors.New("commit failed"))

		err := suite.repo.WithTx(context.TODO(), func(_ TxInterface) error {
			return nil
		})

		suite.Error(err)
		suite.Contains(err.Error(), "commit failed")

		if err := suite.dbMock.ExpectationsWereMet(); err != nil {
			suite.T().Errorf("there were unfulfilled expectations: %s", err)
		}
	})

	suite.Run("Rollback error", func() {
		suite.dbMock.ExpectBegin()
		suite.dbMock.ExpectRollback().WillReturnError(errors.New("rollback failed"))

		err := suite.repo.WithTx(context.TODO(), func(_ TxInterface) error {
			return errors.New("trigger rollback")
		})

		suite.Error(err)
		suite.Contains(err.Error(), "rollback failed")

		if err := suite.dbMock.ExpectationsWereMet(); err != nil {
			suite.T().Errorf("there were unfulfilled expectations: %s", err)
		}
	})

	suite.Run("Start TX error", func() {
		suite.dbMock.ExpectBegin().WillReturnError(errors.New("begin failed"))

		err := suite.repo.WithTx(context.TODO(), func(_ TxInterface) error {
			return nil
		})

		suite.Error(err)
		suite.Contains(err.Error(), "begin failed")

		if err := suite.dbMock.ExpectationsWereMet(); err != nil {
			suite.T().Errorf("there were unfulfilled expectations: %s", err)
		}
	})

	suite.Run("Panic recovery", func() {
		suite.dbMock.ExpectBegin()
		suite.dbMock.ExpectRollback()

		suite.Panics(func() {
			suite.repo.WithTx(context.TODO(), func(_ TxInterface) error {
				panic("panic")
			})
		})

		if err := suite.dbMock.ExpectationsWereMet(); err != nil {
			suite.T().Errorf("there were unfulfilled expectations: %s", err)
		}
	})

}

func TestRepositorySuite(t *testing.T) {
	suite.Run(t, new(RepositorySuite))
}
