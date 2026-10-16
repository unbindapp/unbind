package models

import (
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
)

type ServiceGroupInfoResponse struct {
	ServiceGroup   *ServiceGroupResponse      `json:"service_group"`
	TemplateID     *uuid.UUID                 `json:"template_id,omitempty" format:"uuid"`
	Services       []*ServiceGroupServiceInfo `json:"services" nullable:"false"`
	ValuesRedacted bool                       `json:"values_redacted" doc:"True when the caller may only see variable names. Every variable value is blank. A session needs the editor role; a key or connected app needs the read_variable_values privilege."`
}

func (r *ServiceGroupInfoResponse) Redact() {
	r.ValuesRedacted = true
	for _, service := range r.Services {
		for _, variable := range service.Variables {
			variable.Value = ""
		}
	}
}

type ServiceGroupServiceInfo struct {
	ServiceID uuid.UUID                   `json:"service_id" format:"uuid"`
	Name      string                      `json:"name"`
	Icon      string                      `json:"icon"`
	Hosts     []*ServiceGroupHostInfo     `json:"hosts" nullable:"false"`
	Variables []*ServiceGroupVariableInfo `json:"variables" nullable:"false"`
	Volumes   []*PVCInfo                  `json:"volumes" nullable:"false"`
}

type ServiceGroupHostInfo struct {
	TemplateInputID *string `json:"template_input_id,omitempty"`
	DisplayName     *string `json:"display_name,omitempty"`
	Description     *string `json:"description,omitempty"`
	Host            string  `json:"host"`
	Path            string  `json:"path"`
	TargetPort      *int32  `json:"target_port,omitempty"`
}

type ServiceGroupVariableInfo struct {
	TemplateInputID *string `json:"template_input_id,omitempty"`
	DisplayName     string  `json:"display_name,omitempty"`
	Description     string  `json:"description,omitempty"`
	Name            string  `json:"name"`
	Value           string  `json:"value"`
}

type ServiceGroupTemplateInputsResponse struct {
	ServiceGroupID uuid.UUID                `json:"service_group_id" format:"uuid"`
	TemplateID     *uuid.UUID               `json:"template_id,omitempty" format:"uuid"`
	Version        int                      `json:"version"`
	Inputs         []*DeployedTemplateInput `json:"inputs" nullable:"false"`
	ValuesRedacted bool                     `json:"values_redacted" doc:"True when the caller may only see which variable inputs exist. Every variable input's current_value is blank; hosts and sizes stay. A session needs the editor role; a key or connected app needs the read_variable_values privilege."`
}

func (r *ServiceGroupTemplateInputsResponse) Redact() {
	r.ValuesRedacted = true
	for _, input := range r.Inputs {
		if input.Type == schema.InputTypeVariable {
			input.CurrentValue = ""
		}
	}
}

// DeployedTemplateInput mirrors a template definition input plus its deployed value. Values transport as
// generic strings; size inputs also expose numeric GB (CurrentValueGB / DefaultGB) for resize controls.
type DeployedTemplateInput struct {
	ID           string                   `json:"id"`
	Name         string                   `json:"name"`
	Type         schema.TemplateInputType `json:"type"`
	Volume       *DeployedTemplateVolume  `json:"volume,omitempty"`
	PortProtocol *schema.Protocol         `json:"port_protocol,omitempty"`
	Description  string                   `json:"description"`
	Default      *string                  `json:"default,omitempty"`
	DefaultGB    *float64                 `json:"default_gb,omitempty" doc:"Numeric GB form of Default for volume/database size inputs"`
	Required     bool                     `json:"required"`
	Hidden       bool                     `json:"hidden"`
	TargetPort   *int                     `json:"target_port,omitempty"`

	ServiceID      *uuid.UUID `json:"service_id,omitempty" format:"uuid"`
	CurrentValue   string     `json:"current_value"`
	CurrentValueGB *float64   `json:"current_value_gb,omitempty" doc:"Numeric GB value for volume/database size inputs, consistent with PVCInfo.capacity_gb"`
	Editable       bool       `json:"editable"`
	EditableReason *string    `json:"editable_reason,omitempty"`
}

// DeployedTemplateVolume carries volume metadata; the deployed size lives in CurrentValueGB.
type DeployedTemplateVolume struct {
	Name      string `json:"name"`
	MountPath string `json:"mountPath"`
}
