package dbvolumes

import (
	"fmt"
	"regexp"
	"slices"
	"strings"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/common/names"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/models"
	"github.com/unbindapp/unbind-api/pkg/databases"
)

const nameMaxLength = names.MaxLength

const nameSuffix = "-volume"

// the suffix GenerateSlug appends to keep kubernetes names unique in a namespace
var slugSuffix = regexp.MustCompile(`-[a-z0-9]{12}$`)

// DefaultName is what a database volume is called until someone renames it. Claim names come from
// the engines' operators and are unreadable, so the service the volume belongs to names it instead.
func DefaultName(serviceName string, ordinal int) string {
	suffix := nameSuffix
	if ordinal > 0 {
		suffix = fmt.Sprintf("%s-%d", nameSuffix, ordinal+1)
	}

	slug := utils.Slugify(serviceName)
	if limit := nameMaxLength - len(suffix); len(slug) > limit {
		slug = strings.Trim(slug[:limit], "-")
	}
	if slug == "" {
		slug = "database"
	}
	return slug + suffix
}

// DefaultNameForClaim names a claim after the service it belongs to
func DefaultNameForClaim(serviceName, claim string) string {
	_, ordinal := databases.ClaimBaseName(claim)
	return DefaultName(serviceName, ordinal)
}

// NameFromClaim names a volume whose service is gone, so there is nothing left but the claim
func NameFromClaim(claim string) string {
	base, ordinal := databases.ClaimBaseName(claim)
	if stripped := slugSuffix.ReplaceAllString(base, ""); stripped != "" {
		base = stripped
	}
	return DefaultName(base, ordinal)
}

// ResolveNames fills in the display name and description of every volume: the name its owner gave
// it, else a default. serviceNames holds the name of every service returned by ServiceIDsNeedingNames.
// Defaults are made unique among the volumes of their scope, so pvcs has to hold every volume of
// each scope it touches or the same volume is named differently from one read to the next.
func ResolveNames(pvcs []*models.PVCInfo, metadata map[string]*ent.PVCMetadata, serviceNames map[uuid.UUID]string) {
	takenByScope := make(map[string][]string)
	var unnamed []*models.PVCInfo

	for _, pvc := range pvcs {
		entry, ok := metadata[pvc.ID]
		if ok {
			pvc.Description = entry.Description
		}
		if !ok || needsDefaultName(entry) {
			unnamed = append(unnamed, pvc)
			continue
		}
		pvc.Name = *entry.Name
		takenByScope[ScopeKey(pvc)] = append(takenByScope[ScopeKey(pvc)], pvc.Name)
	}

	// the older volume keeps the plain default
	slices.SortStableFunc(unnamed, func(a, b *models.PVCInfo) int {
		if order := a.CreatedAt.Compare(b.CreatedAt); order != 0 {
			return order
		}
		return strings.Compare(a.ID, b.ID)
	})

	for _, pvc := range unnamed {
		scope := ScopeKey(pvc)
		pvc.Name = names.UniqueSeeded(defaultName(pvc, serviceNames), takenByScope[scope], nameMaxLength, pvc.ID)
		takenByScope[scope] = append(takenByScope[scope], pvc.Name)
	}
}

// ScopeKey groups the volumes whose names have to differ from each other
func ScopeKey(pvc *models.PVCInfo) string {
	if pvc.EnvironmentID != nil {
		return "environment/" + pvc.EnvironmentID.String()
	}
	if pvc.ProjectID != nil {
		return "project/" + pvc.ProjectID.String()
	}
	return "team/" + pvc.TeamID.String()
}

// ScopeLabels selects every volume ResolveNames needs to name pvc
func ScopeLabels(pvc *models.PVCInfo) map[string]string {
	labels := map[string]string{"unbind-team": pvc.TeamID.String()}
	if pvc.EnvironmentID != nil {
		labels["unbind-environment"] = pvc.EnvironmentID.String()
		return labels
	}
	if pvc.ProjectID != nil {
		labels["unbind-project"] = pvc.ProjectID.String()
	}
	return labels
}

// ServiceIDsNeedingNames lists the services ResolveNames has to look up. A volume that carries a
// name of its own does not need one, so renaming a volume costs no service query.
func ServiceIDsNeedingNames(pvcs []*models.PVCInfo, metadata map[string]*ent.PVCMetadata) []uuid.UUID {
	var serviceIDs []uuid.UUID
	for _, pvc := range pvcs {
		if !pvc.IsDatabase || pvc.MountedOnServiceID == nil {
			continue
		}
		if entry, ok := metadata[pvc.ID]; ok && !needsDefaultName(entry) {
			continue
		}
		serviceIDs = append(serviceIDs, *pvc.MountedOnServiceID)
	}
	return serviceIDs
}

func needsDefaultName(entry *ent.PVCMetadata) bool {
	return entry.Name == nil || *entry.Name == ""
}

// only database volumes are named after their service: every other volume is created by name
func defaultName(pvc *models.PVCInfo, serviceNames map[uuid.UUID]string) string {
	if !pvc.IsDatabase {
		return pvc.ID
	}
	if pvc.MountedOnServiceID != nil {
		if name := serviceNames[*pvc.MountedOnServiceID]; name != "" {
			return DefaultNameForClaim(name, pvc.ID)
		}
	}
	return NameFromClaim(pvc.ID)
}
