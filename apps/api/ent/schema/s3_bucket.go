package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema/mixin"
)

// S3Bucket holds the schema definition for the S3Bucket entity.
type S3Bucket struct {
	ent.Schema
}

// Mixin of the S3Bucket.
func (S3Bucket) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.PKMixin{},
		mixin.TimeMixin{},
	}
}

// Fields of the S3Bucket.
func (S3Bucket) Fields() []ent.Field {
	return []ent.Field{
		field.String("name").NotEmpty(),
		field.String("endpoint").NotEmpty(),
		field.String("region"),
		field.String("bucket").NotEmpty(),
		field.String("kubernetes_secret"),
		field.UUID("team_id", uuid.UUID{}),
	}
}

// Edges of the S3Bucket.
func (S3Bucket) Edges() []ent.Edge {
	return []ent.Edge{
		// O2M from team
		edge.From("team", Team.Type).Ref("s3_buckets").Field("team_id").Unique().Required(),
		// O2M to service_configs
		edge.To("service_backup_configs", ServiceConfig.Type),
	}
}

// Annotations of the S3Bucket
func (S3Bucket) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{
			Table: "s3_buckets",
		},
	}
}
