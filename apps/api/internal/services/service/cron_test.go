package service_service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/unbindapp/unbind-api/ent/schema"
)

func TestValidateCronInput(t *testing.T) {
	assert.NoError(t, validateCronInput(schema.ServiceTypeDatabase, nil, nil))
	assert.NoError(t, validateCronInput(schema.ServiceTypeGithub, new("*/10 * * * *"), new("Europe/Berlin")))
	assert.NoError(t, validateCronInput(schema.ServiceTypeDockerimage, new(""), new("")), "empty clears")

	assert.Error(t, validateCronInput(schema.ServiceTypeDatabase, new("0 * * * *"), nil))
	assert.Error(t, validateCronInput(schema.ServiceTypeGithub, new("every hour"), nil))
	assert.Error(t, validateCronInput(schema.ServiceTypeGithub, new("0 * * * *"), new("Mars/Olympus")))
}
