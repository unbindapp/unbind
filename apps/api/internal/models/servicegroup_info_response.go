package models

import (
	"github.com/google/uuid"
)

// ServiceGroupInfoResponse mirrors the template creation screen for a deployed service group.
type ServiceGroupInfoResponse struct {
	ServiceGroup *ServiceGroupResponse      `json:"service_group"`
	TemplateID   *uuid.UUID                 `json:"template_id,omitempty"`
	Services     []*ServiceGroupServiceInfo `json:"services" nullable:"false"`
}

type ServiceGroupServiceInfo struct {
	ServiceID uuid.UUID                   `json:"service_id"`
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
