package main

import (
	"fmt"
	"strings"
)

const (
	registryFullHint = "The registry could not store the image, most often because it is full. Free up space or grow it in System > Settings > Registry."
	diskFullHint     = "The build ran out of disk space on its server."
)

// Registry push errors only carry the status, the registry's reason stays in the response body
func buildFailureReason(builder string, err error, registryHost string) string {
	message := fmt.Sprintf("failed %s build %v", builder, err)

	switch {
	case registryHost != "" && strings.Contains(message, "unexpected status from") &&
		strings.Contains(message, registryHost) && strings.Contains(message, "500 Internal Server Error"):
		return registryFullHint + " " + message
	case strings.Contains(message, "no space left on device"):
		return diskFullHint + " " + message
	}
	return message
}
