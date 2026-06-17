package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
)

// Bootstrap holds the schema definition for the Bootstrap entity.
type Bootstrap struct {
	ent.Schema
}

// Fields of the Bootstrap.
func (Bootstrap) Fields() []ent.Field {
	return []ent.Field{
		field.Bool("is_bootstrapped"),
	}
}

// Edges of the Bootstrap.
func (Bootstrap) Edges() []ent.Edge {
	return nil
}

// Annotations of the Bootstrap
func (Bootstrap) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{
			Table: "bootstrap_flag",
		},
	}
}
