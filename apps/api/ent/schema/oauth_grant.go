package schema

import (
	"reflect"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema/mixin"
)

// OAuthGrant is one user's approval for one client, the "connected app". It
// carries the same access model as an API key and owns the tokens minted for it.
type OAuthGrant struct {
	ent.Schema
}

func (OAuthGrant) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.PKMixin{},
		mixin.TimeMixin{},
	}
}

func (OAuthGrant) Fields() []ent.Field {
	return []ent.Field{
		field.String("client_id"),
		field.String("client_name"),
		field.Enum("client_kind").GoType(OAuthClientKind("")),
		field.String("client_uri").Optional(),
		field.String("redirect_uri"),
		field.Enum("role").GoType(PermittedAction("")),
		field.Bool("full_access").Default(false),
		field.JSON("resources", []APIKeyResource{}),
		field.JSON("privileges", []KeyPrivilege{}).Default([]KeyPrivilege{}).Comment("What the credential may see beyond its role; empty by default"),
		field.String("resource"),
		field.String("scope").Optional(),
		field.Time("last_used_at").Optional().Nillable(),
		field.Time("revoked_at").Optional().Nillable(),
		field.UUID("user_id", uuid.UUID{}),
	}
}

func (OAuthGrant) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).Ref("oauth_grants").Field("user_id").Unique().Required(),
		edge.To("tokens", OAuthGrantToken.Type).Annotations(entsql.Annotation{OnDelete: entsql.Cascade}),
	}
}

func (OAuthGrant) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id"),
		index.Fields("client_id"),
	}
}

func (OAuthGrant) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "oauth_grants"},
	}
}

type OAuthClientKind string

const (
	OAuthClientKindDynamic          OAuthClientKind = "dynamic"
	OAuthClientKindMetadataDocument OAuthClientKind = "metadata_document"
)

var allOAuthClientKinds = []OAuthClientKind{OAuthClientKindDynamic, OAuthClientKindMetadataDocument}

func (OAuthClientKind) Values() (kinds []string) {
	for _, k := range allOAuthClientKinds {
		kinds = append(kinds, string(k))
	}
	return
}

func (OAuthClientKind) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["OAuthClientKind"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "OAuthClientKind")
		schemaRef.Title = "OAuthClientKind"
		for _, k := range allOAuthClientKinds {
			schemaRef.Enum = append(schemaRef.Enum, string(k))
		}
		r.Map()["OAuthClientKind"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/OAuthClientKind"}
}

type OAuthTokenKind string

const (
	OAuthTokenKindAccess  OAuthTokenKind = "access"
	OAuthTokenKindRefresh OAuthTokenKind = "refresh"
)

func (OAuthTokenKind) Values() []string {
	return []string{string(OAuthTokenKindAccess), string(OAuthTokenKindRefresh)}
}
