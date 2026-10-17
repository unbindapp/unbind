package team_repo

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/teamicon"
)

// withIconTime loads when a team's icon last changed, never the file itself.
func withIconTime(q *ent.TeamIconQuery) {
	q.Select(teamicon.FieldUpdatedAt)
}

func (self *TeamRepository) GetIcon(ctx context.Context, teamID uuid.UUID) (*ent.TeamIcon, error) {
	return self.base.DB.TeamIcon.Query().
		Where(teamicon.TeamID(teamID)).
		Only(ctx)
}

func (self *TeamRepository) SetIcon(ctx context.Context, teamID uuid.UUID, contentType string, data []byte) error {
	return self.base.DB.TeamIcon.Create().
		SetTeamID(teamID).
		SetContentType(contentType).
		SetData(data).
		OnConflictColumns(teamicon.FieldTeamID).
		Update(func(u *ent.TeamIconUpsert) {
			u.UpdateContentType()
			u.UpdateData()
			u.SetUpdatedAt(time.Now())
		}).
		Exec(ctx)
}

func (self *TeamRepository) DeleteIcon(ctx context.Context, teamID uuid.UUID) error {
	_, err := self.base.DB.TeamIcon.Delete().
		Where(teamicon.TeamID(teamID)).
		Exec(ctx)
	return err
}
