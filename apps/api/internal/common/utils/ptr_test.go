package utils

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestToPtr(t *testing.T) {
	// Non-nil value case.
	val := 42
	result := ToPtr(val)
	assert.NotNil(t, result, "expected non-nil pointer for non-nil value")
	assert.Equal(t, 42, *result, "expected value to be set in the pointer")
}
