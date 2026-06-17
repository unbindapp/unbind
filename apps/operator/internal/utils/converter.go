package utils

import (
	"encoding/json"

	"k8s.io/apimachinery/pkg/runtime"
)

// RawExtensionToMap converts a runtime.RawExtension to a map.
func RawExtensionToMap(raw runtime.RawExtension) (map[string]any, error) {
	if raw.Raw == nil {
		return make(map[string]any), nil
	}

	var result map[string]any
	err := json.Unmarshal(raw.Raw, &result)
	if err != nil {
		return nil, err
	}

	return result, nil
}
