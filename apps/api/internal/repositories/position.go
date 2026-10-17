package repository

import (
	"bytes"
	"fmt"
	"maps"
	"slices"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
)

// Positioned is one item of a list people arrange by hand, lowest position first
type Positioned struct {
	ID       uuid.UUID
	Position int
}

// Arrange gives the listed IDs the first positions, in the order given, and
// the rest the positions after them in the order they had. current has to be
// in its current order. Only the items whose position changes are returned.
func Arrange(current []Positioned, ids []uuid.UUID, notFound func(id uuid.UUID) string) (map[uuid.UUID]int, error) {
	known := make(map[uuid.UUID]bool, len(current))
	for _, item := range current {
		known[item.ID] = true
	}

	ordered := make([]uuid.UUID, 0, len(current))
	listed := make(map[uuid.UUID]bool, len(ids))
	for _, id := range ids {
		if !known[id] {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, notFound(id))
		}
		if listed[id] {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("%s is listed more than once", id))
		}
		listed[id] = true
		ordered = append(ordered, id)
	}
	for _, item := range current {
		if !listed[item.ID] {
			ordered = append(ordered, item.ID)
		}
	}

	previous := make(map[uuid.UUID]int, len(current))
	for _, item := range current {
		previous[item.ID] = item.Position
	}

	changed := make(map[uuid.UUID]int)
	for i, id := range ordered {
		if previous[id] != i {
			changed[id] = i
		}
	}
	return changed, nil
}

// PositionAbove is the position that puts a new item before all of these
func PositionAbove(positions []int) int {
	if len(positions) == 0 {
		return 0
	}
	return slices.Min(positions) - 1
}

// WriteOrder lists the changed IDs in a fixed order, so two reorders of the
// same list lock rows in the same order and can't deadlock
func WriteOrder(changed map[uuid.UUID]int) []uuid.UUID {
	ids := slices.Collect(maps.Keys(changed))
	slices.SortFunc(ids, func(a, b uuid.UUID) int { return bytes.Compare(a[:], b[:]) })
	return ids
}
