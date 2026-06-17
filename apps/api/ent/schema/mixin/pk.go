package mixin

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/mixin"
	"github.com/google/uuid"
)

type PKMixin struct {
	mixin.Schema
}

func (PKMixin) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).
			Default(uuid.New).
			Immutable().
			StructTag(`json:"id"`).
			Unique().
			Comment("The primary key of the entity."),
	}
}
