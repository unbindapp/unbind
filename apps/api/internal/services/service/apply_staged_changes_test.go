package service_service

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/models"
)

func TestHostClaimedTwice(t *testing.T) {
	first, second := uuid.New(), uuid.New()
	host := func(name string) []schema.HostSpec { return []schema.HostSpec{{Host: name}} }

	t.Run("two services adding one domain", func(t *testing.T) {
		claimed, ok := hostClaimedTwice([]*models.UpdateServiceInput{
			{ServiceID: first, UpsertHosts: host("app.example.com")},
			{ServiceID: second, UpsertHosts: host("APP.example.com")},
		})
		assert.True(t, ok)
		assert.Equal(t, "app.example.com", claimed)
	})

	t.Run("different domains", func(t *testing.T) {
		_, ok := hostClaimedTwice([]*models.UpdateServiceInput{
			{ServiceID: first, UpsertHosts: host("a.example.com")},
			{ServiceID: second, OverwriteHosts: host("b.example.com")},
		})
		assert.False(t, ok)
	})
}

func TestReleasedHosts(t *testing.T) {
	first, second := uuid.New(), uuid.New()
	inputs := []*models.UpdateServiceInput{
		{
			ServiceID:   first,
			RemoveHosts: []schema.HostSpec{{Host: "Removed.example.com"}},
			UpsertHosts: []schema.HostSpec{
				{Host: "new.example.com", PrevHost: new("old.example.com")},
				{Host: "same.example.com", PrevHost: new("same.example.com")},
			},
		},
		{ServiceID: second, RemoveHosts: []schema.HostSpec{{Host: "own.example.com"}}},
	}

	released := releasedHosts(inputs, second)
	assert.Contains(t, released, "removed.example.com")
	assert.Contains(t, released, "old.example.com")
	assert.NotContains(t, released, "same.example.com")
	assert.NotContains(t, released, "own.example.com")
}

func TestSortHostReleasesFirst(t *testing.T) {
	takes := &serviceUpdate{input: &models.UpdateServiceInput{ServiceID: uuid.New(), UpsertHosts: []schema.HostSpec{{Host: "app.example.com"}}}}
	plain := &serviceUpdate{input: &models.UpdateServiceInput{ServiceID: uuid.New()}}
	gives := &serviceUpdate{input: &models.UpdateServiceInput{ServiceID: uuid.New(), RemoveHosts: []schema.HostSpec{{Host: "app.example.com"}}}}

	updates := []*serviceUpdate{takes, plain, gives}
	sortHostReleasesFirst(updates)
	assert.Equal(t, []*serviceUpdate{gives, takes, plain}, updates)
}
