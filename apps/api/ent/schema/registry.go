package schema

import (
	"errors"
	"net/url"
	"strconv"
	"strings"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"github.com/unbindapp/unbind-api/ent/schema/mixin"
)

// Registry holds the schema definition for the Registry entity.
type Registry struct {
	ent.Schema
}

// Mixin of the Registry.
func (Registry) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.PKMixin{},
		mixin.TimeMixin{},
	}
}

// Fields of the Registry.
func (Registry) Fields() []ent.Field {
	return []ent.Field{
		field.String("host").Validate(func(s string) error {
			if strings.Count(s, ":") == 1 {
				parts := strings.Split(s, ":")
				hostname := parts[0]
				port := parts[1]

				// Validate hostname
				if hostname == "" {
					return errors.New("host should not be empty")
				}

				// Validate port
				if _, err := strconv.Atoi(port); err != nil {
					return errors.New("invalid port number")
				}

				return nil
			}

			// Try normla parsing and add a schema
			parsedURL, err := url.Parse("http://" + s)
			if err != nil {
				return errors.New("invalid host format")
			}

			if parsedURL.Hostname() == "" {
				return errors.New("host should not be empty")
			}

			// Make sure the original input doesn't have a scheme
			if strings.Contains(s, "://") {
				return errors.New("host should not contain protocol")
			}

			return nil
		}),
		field.String("kubernetes_secret").
			Comment(
				"The name of the kubernetes registry credentials secret, should be located in the unbind system namespace",
			),
		field.Bool("is_default").
			Comment(
				"If true, this is the registry that will be used for internal CI/CD",
			),
	}
}

// Edges of the Registry.
func (Registry) Edges() []ent.Edge {
	return nil
}

// Annotations of the Registry
func (Registry) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{
			Table: "registries",
		},
	}
}
