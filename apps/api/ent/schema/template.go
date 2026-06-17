package schema

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"reflect"
	"strings"
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/danielgtaylor/huma/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/unbindapp/unbind-api/ent/schema/mixin"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"golang.org/x/crypto/bcrypt"
)

// Template holds the schema definition for the Template entity.
type Template struct {
	ent.Schema
}

// Mixin of the Template.
func (Template) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.PKMixin{},
		mixin.TimeMixin{},
	}
}

// Fields of the Template.
func (Template) Fields() []ent.Field {
	return []ent.Field{
		field.String("name"),
		field.String("description"),
		field.String("icon"),
		field.Strings("keywords").Optional(),
		field.JSON("resource_recommendations", TemplateResourceRecommendations{}),
		field.Uint("display_rank").Default(0).Comment("Rank for ordering results, lower ranks higher"),
		field.Int("version"),
		field.Bool("immutable").Default(false).Comment("If true, the template cannot be modified or deleted (system bundle)"),
		field.JSON("definition", TemplateDefinition{}),
	}
}

// Edges of the Template.
func (Template) Edges() []ent.Edge {
	return []ent.Edge{
		// O2M with service
		edge.To("services", Service.Type),
	}
}

// Indexes of the Template.
func (Template) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("name", "version").Unique(),
	}
}

// Annotations of the Template
func (Template) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{
			Table: "templates",
		},
	}
}

// TemplateDefinition represents a complete template configuration
type TemplateDefinition struct {
	Name                    string                          `json:"name"`
	ResourceRecommendations TemplateResourceRecommendations `json:"resource_recommendations,omitempty"` // Resource recommendations for the template
	DisplayRank             uint                            `json:"display_rank"`                       // Rank for ordering results, lower ranks higher
	Icon                    string                          `json:"icon,omitempty"`                     // Icon name
	Description             string                          `json:"description"`
	Keywords                []string                        `json:"keywords,omitempty"`
	Version                 int                             `json:"version"`
	Services                []TemplateService               `json:"services" nullable:"false"`
	Inputs                  []TemplateInput                 `json:"inputs" nullable:"false"`
}

// TemplateResourceRecommendations represents resource recommendations for a template
type TemplateResourceRecommendations struct {
	MinimumCPUs  float64 `json:"minimum_cpus"`   // Minimum CPUs required
	MinimumRAMGB float64 `json:"minimum_ram_gb"` // Minimum RAM required in GB
}

// TemplateService represents a service within a template
type TemplateService struct {
	ID                 string                      `json:"id"`
	DependsOn          []string                    `json:"depends_on" nullable:"false"` // IDs of services that must be started before this one
	Name               string                      `json:"name"`
	Icon               string                      `json:"icon"`
	Type               ServiceType                 `json:"type"`
	Builder            ServiceBuilder              `json:"builder"`
	DatabaseType       *string                     `json:"database_type,omitempty"`
	DatabaseConfig     *DatabaseConfig             `json:"database_config,omitempty"` // Database configuration
	Image              *string                     `json:"image,omitempty"`
	Ports              []PortSpec                  `json:"ports" nullable:"false"` // Ports to expose
	InputIDs           []string                    `json:"input_ids,omitempty"`    // IDs of inputs that are hostnames
	RunCommand         *string                     `json:"run_command,omitempty"`
	Volumes            []TemplateVolume            `json:"volumes" nullable:"false"`             // Volumes to mount
	Variables          []TemplateVariable          `json:"variables" nullable:"false"`           // Variables this service needs
	VariableReferences []TemplateVariableReference `json:"variable_references" nullable:"false"` // Variables this service needs
	InitContainers     []*InitContainer            `json:"init_containers,omitempty"`            // Init containers to run before the service
	SecurityContext    *SecurityContext            `json:"security_context,omitempty"`           // Security context for the service
	HealthCheck        *HealthCheck                `json:"health_check,omitempty"`               // Health check configuration
	VariablesMounts    []*VariableMount            `json:"variables_mounts" nullable:"false"`    // Variables mounts
	ProtectedVariables []string                    `json:"protected_variables" nullable:"false"` // List of protected variables (can be edited, not deleted)
	InitDBReplacers    map[string]string           `json:"init_db_replacers,omitempty"`          // Replacers for the init DB, will replace key with value in InitDB string
	Resources          *Resources                  `json:"resources,omitempty"`                  // Resources for the service
}

// TemplateVariable represents a configurable variable in a template
type TemplateVariable struct {
	Name  string `json:"name"`
	Value string `json:"value"`
	// If set, the value will be generated using the generator
	Generator *ValueGenerator `json:"generator,omitempty"`
}

// TenokateVariableReference represents a reference to a variable in a template
type TemplateVariableReference struct {
	SourceID                  string   `json:"source_id"`
	TargetName                string   `json:"target_name"`                 // Name of the variable
	SourceName                string   `json:"source_name"`                 // Name of the variable
	AdditionalTemplateSources []string `json:"additional_template_sources"` // Additional template sources to resolve the variable
	TemplateString            string   `json:"template_string"`             // Template string to resolve the variable, in format "abc${VARIABLE_KEY}def"
	IsHost                    bool     `json:"is_host"`                     // If true, variable will be <kubernetesName>.<serviceName>, sort of customized by type (e.g. mysql adds moco- prefix)
	ResolveAsNormalVariable   bool     `json:"resolve_as_normal_variable"`  // If true, the variable will be resolved as a normal variable not a reference
}

// Types of generators
type GeneratorType string

const (
	GeneratorTypeEmail          GeneratorType = "email"
	GeneratorTypePassword       GeneratorType = "password"
	GeneratorTypePasswordBcrypt GeneratorType = "bcrypt"
	GeneratorTypeInput          GeneratorType = "input"
	GeneratorTypeJWT            GeneratorType = "jwt"
	GeneratorTypeStringReplace  GeneratorType = "string_replace"
)

// Register enum in OpenAPI specification
// https://github.com/danielgtaylor/huma/issues/621
func (u GeneratorType) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["GeneratorType"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "GeneratorType")
		schemaRef.Title = "GeneratorType"
		schemaRef.Enum = append(schemaRef.Enum,
			[]any{
				string(GeneratorTypeEmail),
				string(GeneratorTypePassword),
				string(GeneratorTypePasswordBcrypt),
				string(GeneratorTypeInput),
				string(GeneratorTypeJWT),
				string(GeneratorTypeStringReplace),
			}...)
		r.Map()["GeneratorType"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/GeneratorType"}
}

// JWTParams represents the parameters for JWT generation
type JWTParams struct {
	Issuer           string
	SecretOutputKey  string
	AnonOutputKey    string
	ServiceOutputKey string
}

// ValueGenerator represents how to generate a value
type ValueGenerator struct {
	Type       GeneratorType  `json:"type"`
	InputID    string         `json:"input_id,omitempty"`    // For input
	BaseDomain string         `json:"base_domain,omitempty"` // For email
	AddPrefix  string         `json:"add_prefix,omitempty"`  // Add a prefix to the generated value
	HashType   *ValueHashType `json:"hash_type,omitempty"`   // Hash the generated value
	JWTParams  *JWTParams     `json:"jwt_params,omitempty"`  // JWT parameters
}

type ValueHashType string

const (
	ValueHashTypeSHA256 ValueHashType = "sha256"
	ValueHashTypeSHA512 ValueHashType = "sha512"
)

// Register enum in OpenAPI specification
// https://github.com/danielgtaylor/huma/issues/621
func (u ValueHashType) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["ValueHashType"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "ValueHashType")
		schemaRef.Title = "ValueHashType"
		schemaRef.Enum = append(schemaRef.Enum,
			[]any{
				string(ValueHashTypeSHA256),
				string(ValueHashTypeSHA512),
			}...)
		r.Map()["ValueHashType"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/ValueHashType"}
}

type GenerateResponse struct {
	GeneratedValue string            `json:"generated_value"`
	PlainValue     string            `json:"plain_value"`
	JWTValues      map[string]string `json:"jwt_values"`
}

func (self *ValueGenerator) Generate(inputs map[string]string) (*GenerateResponse, error) {
	switch self.Type {
	case GeneratorTypeEmail:
		// Strip http:// or https:// from the base domain
		// Remove port if present and add .com if no domain part is present
		domain := strings.TrimPrefix(self.BaseDomain, "http://")
		domain = strings.TrimPrefix(domain, "https://")
		domain = strings.TrimSuffix(domain, "/")
		if !strings.Contains(domain, ".") {
			domain = domain + ".com"
		}
		return &GenerateResponse{
			GeneratedValue: self.AddPrefix + fmt.Sprintf("admin@%s", domain),
		}, nil
	case GeneratorTypePassword:
		pwd, err := utils.GenerateSecurePassword(32, false)
		if err != nil {
			return nil, err
		}
		if self.HashType != nil {
			switch *self.HashType {
			case ValueHashTypeSHA256:
				hash := sha256.Sum256([]byte(pwd))
				pwd = hex.EncodeToString(hash[:])
			case ValueHashTypeSHA512:
				hash := sha512.Sum512([]byte(pwd))
				pwd = hex.EncodeToString(hash[:])
			}
		}
		return &GenerateResponse{
			GeneratedValue: self.AddPrefix + pwd,
		}, nil
	case GeneratorTypePasswordBcrypt:
		pwd, err := utils.GenerateSecurePassword(32, false)
		if err != nil {
			return nil, err
		}
		if self.HashType != nil {
			switch *self.HashType {
			case ValueHashTypeSHA256:
				hash := sha256.Sum256([]byte(pwd))
				pwd = hex.EncodeToString(hash[:])
			case ValueHashTypeSHA512:
				hash := sha512.Sum512([]byte(pwd))
				pwd = hex.EncodeToString(hash[:])
			}
		}
		bcryptHashed, err := bcrypt.GenerateFromPassword([]byte(pwd), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		return &GenerateResponse{
			GeneratedValue: string(bcryptHashed),
			PlainValue:     pwd,
		}, nil
	case GeneratorTypeInput:
		// Find the input by ID
		inputValue, ok := inputs[self.InputID]
		if !ok {
			return nil, fmt.Errorf("input ID %s not found in inputs map", self.InputID)
		}
		return &GenerateResponse{
			GeneratedValue: self.AddPrefix + inputValue,
		}, nil
	case GeneratorTypeJWT:
		if self.JWTParams == nil {
			return nil, fmt.Errorf("JWT parameters are required for JWT generator")
		}

		resp := make(map[string]string)

		// 32 random bytes = 256-bit key, the minimum Supabase recommends
		secretBytes := make([]byte, 32)
		if _, err := rand.Read(secretBytes); err != nil {
			return nil, err
		}
		secret := base64.RawURLEncoding.EncodeToString(secretBytes)
		resp[self.JWTParams.SecretOutputKey] = secret

		makeToken := func(role string) (string, error) {
			claims := jwt.MapClaims{
				"role": role,
				"iss":  self.JWTParams.Issuer,
				"sub":  role,
				"aud":  "authenticated",
				"iat":  time.Now().Unix(),
				"exp":  time.Now().AddDate(10, 0, 0).Unix(), // 10 years
			}
			token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
			return token.SignedString([]byte(secret))
		}

		anon, err := makeToken("anon")
		if err != nil {
			return nil, err
		}
		resp[self.JWTParams.AnonOutputKey] = anon
		service, err := makeToken("service_role")
		if err != nil {
			return nil, err
		}
		resp[self.JWTParams.ServiceOutputKey] = service

		return &GenerateResponse{
			JWTValues: resp,
		}, nil
	default:
		return nil, fmt.Errorf("unknown generator type: %s", self.Type)
	}
}

// TemplateInputType represents the type of user input
type TemplateInputType string

const (
	InputTypeVariable          TemplateInputType = "variable"
	InputTypeHost              TemplateInputType = "host"
	InputTypeVolumeSize        TemplateInputType = "volume-size"
	InputTypeDatabaseSize      TemplateInputType = "database-size"
	InputTypeGeneratedNodePort TemplateInputType = "generated-node-port"
	InputTypeGeneratedPassword TemplateInputType = "generated-password"
	InputTypeGeneratedNodeIP   TemplateInputType = "generated-node-ip" // For node IPs, e.g. for wg-easy
)

// Register the enum in OpenAPI specification
// https://github.com/danielgtaylor/huma/issues/621
func (u TemplateInputType) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["TemplateInputType"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "TemplateInputType")
		schemaRef.Title = "TemplateInputType"
		schemaRef.Enum = append(schemaRef.Enum,
			[]any{
				string(InputTypeVariable),
				string(InputTypeHost),
				string(InputTypeVolumeSize),
				string(InputTypeDatabaseSize),
				string(InputTypeGeneratedNodePort),
				string(InputTypeGeneratedPassword),
				string(InputTypeGeneratedNodeIP),
			}...)
		r.Map()["TemplateInputType"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/TemplateInputType"}
}

// TemplateInput represents a user input field in the template
type TemplateInput struct {
	ID           string            `json:"id"`
	Name         string            `json:"name"`
	Type         TemplateInputType `json:"type"`
	Volume       *TemplateVolume   `json:"volume,omitempty"`
	PortProtocol *Protocol         `json:"port_protocol,omitempty"` // Protocol for the port
	Description  string            `json:"description"`
	Default      *string           `json:"default,omitempty"`
	Required     bool              `json:"required"`
	Hidden       bool              `json:"hidden"`
	TargetPort   *int              `json:"target_port,omitempty"`
}

// TemplateVolume represents a volume configuration in the template
type TemplateVolume struct {
	Name       string `json:"name"`
	CapacityGB string `json:"capacity_gb"`
	MountPath  string `json:"mountPath"`
}
