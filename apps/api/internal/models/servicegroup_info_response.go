package models

import (
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
)

type ServiceGroupInfoResponse struct {
	ServiceGroup *ServiceGroupResponse      `json:"service_group"`
	TemplateID   *uuid.UUID                 `json:"template_id,omitempty" format:"uuid"`
	Services     []*ServiceGroupServiceInfo `json:"services" nullable:"false"`
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
	TemplateID *uuid.UUID               `json:"template_id,omitempty" format:"uuid"`
	Version    int                      `json:"version"`
	Inputs     []*DeployedTemplateInput `json:"inputs" nullable:"false"`
}

// DeployedTemplateInput mirrors a template definition input (so the UI renders it with the same
// form components as the creation screen), flattened with the deployed current value and owning service.
//
// Input values are transported as generic strings (CurrentValue / Default), matching the polymorphic
// template form system where every input type carries a string. For volume/database size inputs the
// value is ALSO surfaced as a numeric GB (CurrentValueGB / DefaultGB) so the edit screen can drive the
// same numeric controls the volume-resize flow uses, consistent with PVCInfo.CapacityGB.
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

// DeployedTemplateVolume carries the volume metadata for a size input. Capacity is intentionally not
// duplicated here; the deployed size lives in DeployedTemplateInput.CurrentValueGB.
type DeployedTemplateVolume struct {
	Name      string `json:"name"`
	MountPath string `json:"mountPath"`
}
