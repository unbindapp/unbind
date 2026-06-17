package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"github.com/unbindapp/unbind-api/ent/schema/mixin"
)

// PVCMetadata holds the schema definition for the PVCMetadata entity.
type PVCMetadata struct {
	ent.Schema
}

// Mixin of the PVCMetadata.
func (PVCMetadata) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.PKMixin{},
		mixin.TimeMixin{},
	}
}

// Fields of the PVCMetadata.
func (PVCMetadata) Fields() []ent.Field {
	return []ent.Field{
		field.String("pvc_id").Unique().Comment("ID of the PVC"),
		field.String("name").Optional().Nillable().Comment("Display name of the PVC"),
		field.String("description").Optional().Nillable().Comment("Description of the PVC"),
	}
}

// Edges of the PVCMetadata.
func (PVCMetadata) Edges() []ent.Edge {
	return nil
}

// Annotations of the PVCMetadata
func (PVCMetadata) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{
			Table: "pvc_metadata",
		},
	}
}
