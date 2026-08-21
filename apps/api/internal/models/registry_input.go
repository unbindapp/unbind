package models

import "github.com/google/uuid"

type CreateRegistryInput struct {
	Host     string `json:"host" pattern:"^[A-Za-z0-9.-]+(:[0-9]{1,5})?$" required:"true"`
	Username string `json:"username" required:"true" minLength:"1"`
	Password string `json:"password" required:"true" minLength:"1"`
	Insecure bool   `json:"insecure,omitempty" doc:"Registry is served over plain HTTP or with an untrusted TLS certificate"`
}

// We only allow them to update the default registry for now
type SetDefaultRegistryInput struct {
	ID uuid.UUID `json:"id" format:"uuid" required:"true"`
}

type DeleteRegistryInput struct {
	ID uuid.UUID `json:"id" format:"uuid" required:"true"`
}

type GetRegistryInput struct {
	ID uuid.UUID `query:"id" format:"uuid" required:"true"`
}
