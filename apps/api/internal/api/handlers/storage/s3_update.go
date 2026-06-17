package storage_handler

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
)

type UpdateS3SourceInput struct {
	server.BaseAuthInput
	Body struct {
		ID          uuid.UUID `json:"id" format:"uuid" required:"true"`
		TeamID      uuid.UUID `json:"team_id" format:"uuid" required:"true"`
		Name        *string   `json:"name,omitempty" required:"false" minLength:"1"`
		AccessKeyID *string   `json:"access_key_id,omitempty" required:"false" minLength:"1"`
		SecretKey   *string   `json:"secret_key,omitempty" required:"false" minLength:"1"`
	}
}

type UpdateS3SourceResponse struct {
	Body struct {
		Data *models.S3Response `json:"data"`
	}
}

func (self *HandlerGroup) UpdateS3Source(ctx context.Context, input *UpdateS3SourceInput) (*UpdateS3SourceResponse, error) {
	// Get caller
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		log.Error("Error getting user from context")
		return nil, huma.Error401Unauthorized("Unable to retrieve user")
	}
	bearerToken, _ := self.srv.GetBearerTokenFromContext(ctx)

	endpoint, err := self.srv.StorageService.UpdateS3Storage(
		ctx,
		user.ID,
		bearerToken,
		input.Body.TeamID,
		input.Body.ID,
		input.Body.Name,
		input.Body.AccessKeyID,
		input.Body.SecretKey,
	)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &UpdateS3SourceResponse{}
	resp.Body.Data = endpoint
	return resp, nil
}
