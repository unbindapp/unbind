package utils

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// TestFromPtrInt tests the FromPtr function with an int.
func TestFromPtrInt(t *testing.T) {
	// Non-nil pointer case.
	val := 42
	result := FromPtr(&val)
	assert.Equal(t, 42, result, "expected int value from non-nil pointer")

	// Nil pointer case.
	var nilInt *int
	resultNil := FromPtr(nilInt)
	assert.Equal(t, 0, resultNil, "expected zero value for int when pointer is nil")
}

// TestFromPtrString tests the FromPtr function with a string.
func TestFromPtrString(t *testing.T) {
	// Non-nil pointer case.
	str := "hello"
	result := FromPtr(&str)
	assert.Equal(t, "hello", result, "expected string value from non-nil pointer")

	// Nil pointer case.
	var nilStr *string
	resultNil := FromPtr(nilStr)
	assert.Equal(t, "", resultNil, "expected empty string for nil pointer")
}

// MyStruct is a sample struct used for testing.
type MyStruct struct {
	A int
	B string
}

// TestFromPtrStruct tests the FromPtr function with a custom struct.
func TestFromPtrStruct(t *testing.T) {
	// Non-nil pointer case.
	s := MyStruct{A: 10, B: "world"}
	result := FromPtr(&s)
	assert.Equal(t, s, result, "expected struct value from non-nil pointer")

	// Nil pointer case.
	var nilStruct *MyStruct
	resultNil := FromPtr(nilStruct)
	assert.Equal(t, MyStruct{}, resultNil, "expected zero value for struct when pointer is nil")
}

func TestToPtr(t *testing.T) {
	// Non-nil value case.
	val := 42
	result := ToPtr(val)
	assert.NotNil(t, result, "expected non-nil pointer for non-nil value")
	assert.Equal(t, 42, *result, "expected value to be set in the pointer")
}
