package main

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/infrastructure/registrycache"
)

// A registry cleanup that overlaps the push can drop blobs of the image. Pushing again uploads them.
func buildVerified(ctx context.Context, systemNamespace string, build func() (string, error)) (string, error) {
	image, err := build()
	if err != nil && !isBlobUnknown(err) {
		return "", err
	}
	if err == nil {
		err = verifyPushedImage(ctx, systemNamespace, image)
		if !errors.Is(err, registrycache.ErrImageIncomplete) {
			if err != nil {
				log.Warnf("Could not verify the pushed image: %v", err)
			}
			return image, nil
		}
	}

	log.Warnf("The registry lost part of the pushed image, pushing it again: %v", err)
	image, err = build()
	if err != nil {
		return "", err
	}
	if err := verifyPushedImage(ctx, systemNamespace, image); errors.Is(err, registrycache.ErrImageIncomplete) {
		return "", err
	}
	return image, nil
}

func isBlobUnknown(err error) bool {
	return strings.Contains(strings.ToLower(err.Error()), "blob unknown")
}

// Only the internal registry runs cleanup, an external one is not checked
func verifyPushedImage(ctx context.Context, systemNamespace, image string) error {
	repo, tag, ok := internalImageRef(systemNamespace, image)
	if !ok {
		return nil
	}
	return registrycache.NewClient(registrycache.RegistryURL(systemNamespace)).VerifyImage(ctx, repo, tag)
}

func internalImageRef(systemNamespace, image string) (repo, tag string, ok bool) {
	host := fmt.Sprintf("%s.%s:%d/", registrycache.RegistryServiceName, systemNamespace, registrycache.RegistryServicePort)
	ref, found := strings.CutPrefix(image, host)
	if !found {
		return "", "", false
	}
	colon := strings.LastIndex(ref, ":")
	if colon <= 0 || strings.Contains(ref[colon:], "/") {
		return "", "", false
	}
	return ref[:colon], ref[colon+1:], true
}
