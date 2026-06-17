package models

import (
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
)

type RegistryResponse struct {
	ID       uuid.UUID `json:"id"`
	Host     string    `json:"Host"`
	Username string    `json:"username"`
}

func TransformRegistryEntity(entity *ent.Registry, username string) *RegistryResponse {
	return &RegistryResponse{
		ID:       entity.ID,
		Host:     entity.Host,
		Username: username,
	}
}

func TransformRegistryEntities(entities []*ent.Registry, usernameMap map[uuid.UUID]string) []*RegistryResponse {
	responses := make([]*RegistryResponse, len(entities))
	for i, entity := range entities {
		responses[i] = TransformRegistryEntity(entity, usernameMap[entity.ID])
	}
	return responses
}
