package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"github.com/unbindapp/unbind-api/ent/schema/mixin"
)

// Sub categories
type BuildkitSettings struct {
	MaxParallelism int `json:"max_parallelism"`
	Replicas       int `json:"replicas"`
}

// SystemSetting holds the schema definition for the SystemSetting entity.
type SystemSetting struct {
	ent.Schema
}

// Mixin of the SystemSetting.
func (SystemSetting) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.PKMixin{},
		mixin.TimeMixin{},
	}
}

// Fields of the SystemSetting.
func (SystemSetting) Fields() []ent.Field {
	return []ent.Field{
		field.String("wildcard_base_url").Optional().Nillable().Comment("Wildcard base URL for the system"),
		field.JSON("buildkit_settings", &BuildkitSettings{}).
			Optional().
			Comment("Buildkit settings"),
	}
}

// Edges of the SystemSetting.
func (SystemSetting) Edges() []ent.Edge {
	return nil
}

// Annotations of the SystemSetting
func (SystemSetting) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{
			Table: "system_settings",
		},
	}
}
