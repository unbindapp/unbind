package main

import (
	"encoding/base64"
	"encoding/json"

	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/pkg/builder/config"
)

// decodeEnvJSON parses a JSON map of base64 values, skipping entries that fail to decode
func decodeEnvJSON(raw string) (map[string]string, error) {
	env := make(map[string]string)
	if raw == "" {
		return env, nil
	}

	encoded := make(map[string]string)
	if err := json.Unmarshal([]byte(raw), &encoded); err != nil {
		return nil, err
	}

	for k, v := range encoded {
		data, err := base64.StdEncoding.DecodeString(v)
		if err != nil {
			log.Warnf("Error decoding env %s: %v", k, err)
			continue
		}
		env[k] = string(data)
	}
	return env, nil
}

// mergeBuildSecrets layers the raw service secret under the rendered references so rendered values win
func mergeBuildSecrets(cfg *config.Config, rawSecrets, renderedEnv map[string]string) map[string]string {
	buildSecrets := make(map[string]string, len(rawSecrets)+len(renderedEnv)+2)

	if cfg.RailpackInstallCommand != "" {
		buildSecrets["RAILPACK_INSTALL_CMD"] = cfg.RailpackInstallCommand
	}
	if cfg.RailpackBuildCommand != "" {
		buildSecrets["RAILPACK_BUILD_CMD"] = cfg.RailpackBuildCommand
	}

	for k, v := range rawSecrets {
		buildSecrets[k] = v
	}
	for k, v := range renderedEnv {
		buildSecrets[k] = v
	}
	return buildSecrets
}
