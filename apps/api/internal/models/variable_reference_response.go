package models

import (
	"slices"
	"strings"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
)

type AvailableVariableReference struct {
	Type                 schema.VariableReferenceType       `json:"type"`
	SourceKubernetesName string                             `json:"source_kubernetes_name"`
	SourceName           string                             `json:"source_name"`
	SourceIcon           string                             `json:"source_icon"`
	SourceType           schema.VariableReferenceSourceType `json:"source_type"`
	SourceID             uuid.UUID                          `json:"source_id" format:"uuid"`
	Keys                 []string                           `json:"keys"`
}

func compareAvailableVariableReferences(a, b AvailableVariableReference) int {
	if a.Type != b.Type {
		return strings.Compare(string(a.Type), string(b.Type))
	}

	aPriority := getSourceTypePriority(a.SourceType)
	bPriority := getSourceTypePriority(b.SourceType)
	if aPriority != bPriority {
		return aPriority - bPriority
	}

	return strings.Compare(a.SourceKubernetesName, b.SourceKubernetesName)
}

func getSourceTypePriority(sourceType schema.VariableReferenceSourceType) int {
	switch sourceType {
	case schema.VariableReferenceSourceTypeTeam:
		return 0
	case schema.VariableReferenceSourceTypeProject:
		return 1
	case schema.VariableReferenceSourceTypeEnvironment:
		return 2
	case schema.VariableReferenceSourceTypeService:
		return 3
	default:
		return 4
	}
}

// SecretData represents a Kubernetes secret with its metadata
type SecretData struct {
	ID         uuid.UUID
	Type       schema.VariableReferenceSourceType
	SecretName string
	Keys       []string
}

func TransformAvailableVariableResponse(secretData []SecretData, endpoints []AvailableVariableReference, kubernetesNameMap map[uuid.UUID]string, nameMap map[uuid.UUID]string, iconMap map[uuid.UUID]string) []AvailableVariableReference {
	resp := make([]AvailableVariableReference, 0, len(secretData)+len(endpoints))

	for _, secret := range secretData {
		resp = append(resp, AvailableVariableReference{
			Type:                 schema.VariableReferenceTypeVariable,
			SourceName:           nameMap[secret.ID],
			SourceIcon:           iconMap[secret.ID],
			SourceKubernetesName: kubernetesNameMap[secret.ID],
			SourceType:           secret.Type,
			SourceID:             secret.ID,
			Keys:                 secret.Keys,
		})
	}

	resp = append(resp, endpoints...)
	slices.SortFunc(resp, compareAvailableVariableReferences)
	return resp
}
