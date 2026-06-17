package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
)

// JWTKey holds the schema definition for the JWTKey entity.
type JWTKey struct {
	ent.Schema
}

// Fields of the JWTKey.
func (JWTKey) Fields() []ent.Field {
	return []ent.Field{
		field.String("label"),
		// You can store the PEM data as either []byte or string.
		// We'll do []byte here:
		field.Bytes("private_key"),
	}
}

// Annotations of the Oauth2Code.
func (JWTKey) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{
			Table: "jwt_keys",
		},
	}
}
