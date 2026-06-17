package models

import (
	"reflect"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
)

// PVCInfo holds prettier information about a PVC.
type PVCInfo struct {
	ID                 string                     `json:"id"`
	Name               string                     `json:"name"`
	Description        *string                    `json:"description,omitempty"`
	Type               PvcScope                   `json:"type"`
	MountPath          *string                    `json:"mount_path,omitempty"`
	UsedGB             *float64                   `json:"used_gb,omitempty"` // e.g., "10"
	CapacityGB         float64                    `json:"capacity_gb"`       // e.g., "10"
	TeamID             uuid.UUID                  `json:"team_id"`
	ProjectID          *uuid.UUID                 `json:"project_id,omitempty"`
	EnvironmentID      *uuid.UUID                 `json:"environment_id,omitempty"`
	MountedOnServiceID *uuid.UUID                 `json:"mounted_on_service_id,omitempty"`
	Status             PersistentVolumeClaimPhase `json:"status"` // e.g., "Bound", "Pending"
	IsDatabase         bool                       `json:"is_database"`
	IsAvailable        bool                       `json:"is_available"`
	IsPendingResize    bool                       `json:"is_pending_resize"`
	CanDelete          bool                       `json:"can_delete"`
	CreatedAt          time.Time                  `json:"created_at"`
}

// Enum for PVC status
type PersistentVolumeClaimPhase string

const (
	ClaimPending PersistentVolumeClaimPhase = "Pending"
	ClaimBound   PersistentVolumeClaimPhase = "Bound"
	ClaimLost    PersistentVolumeClaimPhase = "Lost"
)

// Register enum in OpenAPI specification
// https://github.com/danielgtaylor/huma/issues/621
func (u PersistentVolumeClaimPhase) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["PersistentVolumeClaimPhase"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "PersistentVolumeClaimPhase")
		schemaRef.Title = "PersistentVolumeClaimPhase"
		schemaRef.Enum = append(schemaRef.Enum, []any{
			string(ClaimPending),
			string(ClaimBound),
			string(ClaimLost),
		}...)
		r.Map()["PersistentVolumeClaimPhase"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/PersistentVolumeClaimPhase"}
}
