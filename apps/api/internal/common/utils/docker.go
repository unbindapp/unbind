package utils

import (
	"fmt"

	"github.com/google/go-containerregistry/pkg/authn"
	"github.com/google/go-containerregistry/pkg/name"
	"github.com/google/go-containerregistry/pkg/v1/remote"
)

// GetexportedPortsFromRegistry detects exposed ports from a docker manifest, in 8080/tcp format
func GetExposedPortsFromRegistry(imageName string) ([]string, error) {
	ref, err := name.ParseReference(imageName)
	if err != nil {
		return nil, fmt.Errorf("invalid image name %s: %v", imageName, err)
	}

	// ! TODO - support regcred?
	img, err := remote.Image(ref, remote.WithAuthFromKeychain(authn.DefaultKeychain))
	if err != nil {
		return nil, fmt.Errorf("failed to get image from registry: %v", err)
	}

	configFile, err := img.ConfigFile()
	if err != nil {
		return nil, fmt.Errorf("failed to get image config: %v", err)
	}

	ports := []string{}
	for port := range configFile.Config.ExposedPorts {
		ports = append(ports, port)
	}

	return ports, nil
}
