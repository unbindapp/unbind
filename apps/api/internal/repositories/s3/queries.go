package s3_repo

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/s3"
)

func (self *S3Repository) GetByID(ctx context.Context, id uuid.UUID) (*ent.S3, error) {
	return self.base.DB.S3.
		Query().
		Where(s3.ID(id)).
		Only(ctx)
}

func (self *S3Repository) GetByTeam(ctx context.Context, teamID uuid.UUID) ([]*ent.S3, error) {
	return self.base.DB.S3.
		Query().
		Where(s3.TeamIDEQ(teamID)).
		Order(ent.Desc(s3.FieldCreatedAt)).
		All(ctx)
}
