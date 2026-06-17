package models

import "github.com/google/uuid"

type S3BackendCreateInput struct {
	TeamID      uuid.UUID `json:"team_id" format:"uuid" required:"true"`
	Name        string    `json:"name" required:"true"`
	Endpoint    string    `json:"endpoint" required:"true"`
	Region      string    `json:"region" required:"true"`
	AccessKeyID string    `json:"access_key_id" required:"true"`
	SecretKey   string    `json:"secret_key" required:"true"`
}
