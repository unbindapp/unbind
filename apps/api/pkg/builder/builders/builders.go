package builders

import (
	"fmt"
	"time"

	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/pkg/builder/config"
)

type Builder struct {
	config *config.Config
}

func NewBuilder(config *config.Config) *Builder {
	return &Builder{
		config: config,
	}
}

// Generates build metadata:
// - repoName: name of the repository to be used for the image name (like git repo name)
// - outputImage: the name of the image to be built and pushed
// - cacheKey: the key to be used for caching the build in the registry
func (self *Builder) GenerateBuildMetadata() (repoName string, outputImage string, cacheKey string) {
	// -- Generate image name
	repoName, err := utils.ExtractRepoName(self.config.GitRepoURL)
	if err != nil {
		log.Warnf("Failed to extract repository name: %v", err)
		repoName = fmt.Sprintf("unbind-build-%d", time.Now().Unix())
	}
	if self.config.ContainerRegistryHost == "" || self.config.ContainerRegistryHost == "docker.io" {
		outputImage = fmt.Sprintf("%s/%s:%d", self.config.ContainerRegistryUser, repoName, time.Now().Unix())
		cacheKey = fmt.Sprintf("%s/%s:buildcache", self.config.ContainerRegistryUser, repoName)
	} else {
		// Prepend registry URL to image name if configured
		outputImage = fmt.Sprintf("%s/%s:%d", self.config.ContainerRegistryHost, repoName, time.Now().Unix())
		cacheKey = fmt.Sprintf("%s/%s:buildcache", self.config.ContainerRegistryHost, repoName)
	}

	return repoName, outputImage, cacheKey
}
