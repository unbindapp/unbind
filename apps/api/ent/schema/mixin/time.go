package mixin

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/mixin"
)

type TimeMixin struct {
	mixin.Schema
}

func (TimeMixin) Fields() []ent.Field {
	return []ent.Field{
		field.Time("created_at").
			Immutable().
			Default(time.Now).
			Comment("The time at which the entity was created."),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now).
			Comment("The time at which the entity was last updated."),
	}
}
