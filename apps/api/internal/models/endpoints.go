package models

import (
	"reflect"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
)

type EndpointDiscovery struct {
	Internal []ServiceEndpoint `json:"internal" nullable:"false"`
	External []IngressEndpoint `json:"external" nullable:"false"`
}

// ServiceEndpoint represents internal DNS information for a Kubernetes service
type ServiceEndpoint struct {
	KubernetesName string            `json:"kubernetes_name"`
	DNS            string            `json:"dns"`
	Ports          []schema.PortSpec `json:"ports" nullable:"false"`
	TeamID         uuid.UUID         `json:"team_id"`
	ProjectID      uuid.UUID         `json:"project_id"`
	EnvironmentID  uuid.UUID         `json:"environment_id"`
	ServiceID      uuid.UUID         `json:"service_id"`
}

// IngressEndpoint represents external DNS information for a Kubernetes ingress
type IngressEndpoint struct {
	KubernetesName    string           `json:"kubernetes_name"`
	IsIngress         bool             `json:"is_ingress"`
	Host              string           `json:"host"`
	Path              string           `json:"path"`
	TargetPort        *schema.PortSpec `json:"target_port,omitempty"`
	DNSStatus         DNSStatus        `json:"dns_status"`
	IsCloudflare      bool             `json:"is_cloudflare"`
	TlsStatus         TlsStatus        `json:"tls_status"`
	TlsIssuerMessages []TlsDetails     `json:"tls_issuer_messages,omitempty"`
	TeamID            uuid.UUID        `json:"team_id"`
	ProjectID         uuid.UUID        `json:"project_id"`
	EnvironmentID     uuid.UUID        `json:"environment_id"`
	ServiceID         uuid.UUID        `json:"service_id"`
}

// DNSStatus
type DNSStatus string

const (
	DNSStatusUnknown    DNSStatus = "unknown"
	DNSStatusResolved   DNSStatus = "resolved"
	DNSStatusUnresolved DNSStatus = "unresolved"
)

// Register enum in OpenAPI specification
// https://github.com/danielgtaylor/huma/issues/621
func (u DNSStatus) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["DNSStatus"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "DNSStatus")
		schemaRef.Title = "DNSStatus"
		schemaRef.Enum = append(schemaRef.Enum,
			[]any{
				string(DNSStatusUnknown),
				string(DNSStatusResolved),
				string(DNSStatusUnresolved),
			}...,
		)
		r.Map()["DNSStatus"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/DNSStatus"}
}

// TlsStatus
type TlsStatus string

const (
	TlsStatusPending      TlsStatus = "pending"
	TlsStatusAttempting   TlsStatus = "attempting"
	TlsStatusIssued       TlsStatus = "issued"
	TlsStatusNotAvailable TlsStatus = "not_available"
)

// Register enum in OpenAPI specification
// https://github.com/danielgtaylor/huma/issues/621
func (u TlsStatus) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["TlsStatus"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "TlsStatus")
		schemaRef.Title = "TlsStatus"
		schemaRef.Enum = append(schemaRef.Enum,
			[]any{
				string(TlsStatusPending),
				string(TlsStatusAttempting),
				string(TlsStatusIssued),
				string(TlsStatusNotAvailable),
			}...,
		)
		r.Map()["TlsStatus"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/TlsStatus"}
}

// TLS Details
type TlsDetails struct {
	Condition CertManagerConditionType `json:"condition"`
	Reason    string                   `json:"reason"`
	Message   string                   `json:"message"`
}

type CertManagerConditionType string

const (
	CertificateRequestConditionReady          CertManagerConditionType = "Ready"
	CertificateRequestConditionInvalidRequest CertManagerConditionType = "InvalidRequest"
	CertificateRequestConditionApproved       CertManagerConditionType = "Approved"
	CertificateRequestConditionDenied         CertManagerConditionType = "Denied"
)

// Register enum in OpenAPI specification
// https://github.com/danielgtaylor/huma/issues/621
func (u CertManagerConditionType) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["CertManagerCondition"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "CertManagerCondition")
		schemaRef.Title = "CertManagerCondition"
		schemaRef.Enum = append(schemaRef.Enum,
			[]any{
				string(CertificateRequestConditionReady),
				string(CertificateRequestConditionInvalidRequest),
				string(CertificateRequestConditionApproved),
				string(CertificateRequestConditionDenied),
			}...,
		)
		r.Map()["CertManagerCondition"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/CertManagerCondition"}
}
