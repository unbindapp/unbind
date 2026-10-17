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
	MaxParallelism int `json:"max_parallelism" minimum:"1" maximum:"32"`
	Replicas       int `json:"replicas" minimum:"1" maximum:"10"`
}

// RegistryCacheSettings holds the desired configuration for the self-hosted
// registry cleanup job (build cache + images share a single registry volume).
type RegistryCacheSettings struct {
	CleanupThresholdGB float64 `json:"cleanup_threshold_gb"`
	CleanupSchedule    string  `json:"cleanup_schedule"`
	PVCCapacityGB      float64 `json:"pvc_capacity_gb"`
}

// EmailSettings is the outgoing SMTP relay. The password lives in a Kubernetes
// secret in the system namespace, never in the database.
type EmailSettings struct {
	Host        string `json:"host" required:"true" minLength:"1"`
	Port        int    `json:"port" required:"true" minimum:"1" maximum:"65535"`
	Username    string `json:"username" required:"false"`
	FromAddress string `json:"from_address" required:"true" format:"email"`
	FromName    string `json:"from_name" required:"false"`
	Encryption  string `json:"encryption" required:"true" enum:"starttls,tls,none" doc:"starttls upgrades the connection (usually port 587), tls connects encrypted (usually port 465), none sends in the clear"`
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
		field.JSON("registry_cache_settings", &RegistryCacheSettings{}).
			Optional().
			Comment("Registry cache cleanup settings"),
		field.JSON("email_settings", &EmailSettings{}).
			Optional().
			Comment("Outgoing mail relay, password kept in a Kubernetes secret"),
		field.Bool("team_network_isolation").
			Default(true).
			Comment("Whether pods only accept connections from their own team, the system and network exceptions"),
		field.Bool("service_reference_syntax_migrated").
			Default(false).
			Comment("Whether stored variables were rewritten from ${{service.<id>.KEY}} to ${{service:<id>.KEY}}"),
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
