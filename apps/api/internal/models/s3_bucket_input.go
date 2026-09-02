package models

import "github.com/google/uuid"

type S3BucketCreateInput struct {
	TeamID      uuid.UUID `json:"team_id" format:"uuid" required:"true"`
	Name        string    `json:"name" required:"true" minLength:"1"`
	Endpoint    string    `json:"endpoint" required:"true" minLength:"1"`
	Region      string    `json:"region" required:"true"`
	Bucket      string    `json:"bucket" required:"true" minLength:"1"`
	AccessKeyID string    `json:"access_key_id" required:"true" minLength:"1"`
	SecretKey   string    `json:"secret_key" required:"true" minLength:"1"`
}

type S3BucketUpdateInput struct {
	ID          uuid.UUID `json:"id" format:"uuid" required:"true"`
	TeamID      uuid.UUID `json:"team_id" format:"uuid" required:"true"`
	Name        *string   `json:"name,omitempty" required:"false" minLength:"1"`
	Endpoint    *string   `json:"endpoint,omitempty" required:"false" minLength:"1"`
	Region      *string   `json:"region,omitempty" required:"false"`
	Bucket      *string   `json:"bucket,omitempty" required:"false" minLength:"1"`
	AccessKeyID *string   `json:"access_key_id,omitempty" required:"false" minLength:"1"`
	SecretKey   *string   `json:"secret_key,omitempty" required:"false" minLength:"1"`
}

func (self *S3BucketUpdateInput) HasChanges() bool {
	return self.Name != nil || self.ConnectionChanged()
}

func (self *S3BucketUpdateInput) ConnectionChanged() bool {
	return self.Endpoint != nil || self.Region != nil || self.Bucket != nil || self.AccessKeyID != nil || self.SecretKey != nil
}
