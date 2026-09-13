package dbvolumes

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/models"
	"github.com/unbindapp/unbind-api/pkg/databases"
)

// matches the limit the rename dialog enforces in the UI
const nameMaxLength = 32

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
func ResolveNames(pvcs []*models.PVCInfo, metadata map[string]*ent.PVCMetadata, serviceNames map[uuid.UUID]string) {
	for _, pvc := range pvcs {
		if entry, ok := metadata[pvc.ID]; ok {
			pvc.Description = entry.Description
			if !needsDefaultName(entry) {
				pvc.Name = *entry.Name
				continue
			}
		}
		pvc.Name = defaultName(pvc, serviceNames)
	}
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
