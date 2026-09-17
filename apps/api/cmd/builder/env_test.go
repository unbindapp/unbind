package main

import (
	"encoding/base64"
	"encoding/json"
	"testing"

	"github.com/unbindapp/unbind-api/pkg/builder/config"
)

func encodeEnv(t *testing.T, env map[string]string) string {
	t.Helper()
	encoded := make(map[string]string, len(env))
	for k, v := range env {
		encoded[k] = base64.StdEncoding.EncodeToString([]byte(v))
	}
	raw, err := json.Marshal(encoded)
	if err != nil {
		t.Fatalf("marshal env: %v", err)
	}
	return string(raw)
}

func TestDecodeEnvJSONEmptyInputIsEmptyMap(t *testing.T) {
	env, err := decodeEnvJSON("")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(env) != 0 {
		t.Fatalf("expected empty map, got %v", env)
	}
}

func TestDecodeEnvJSONDecodesValues(t *testing.T) {
	env, err := decodeEnvJSON(encodeEnv(t, map[string]string{"API_URL": "https://api.example.com", "EMPTY": ""}))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if env["API_URL"] != "https://api.example.com" {
		t.Fatalf("API_URL = %q", env["API_URL"])
	}
	if v, ok := env["EMPTY"]; !ok || v != "" {
		t.Fatalf("EMPTY = %q, present=%v", v, ok)
	}
}

func TestDecodeEnvJSONInvalidJSONFails(t *testing.T) {
	if _, err := decodeEnvJSON("{not json"); err == nil {
		t.Fatal("expected an error for invalid json")
	}
}

func TestDecodeEnvJSONSkipsUndecodableEntries(t *testing.T) {
	env, err := decodeEnvJSON(`{"GOOD":"` + base64.StdEncoding.EncodeToString([]byte("ok")) + `","BAD":"%%%"}`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if env["GOOD"] != "ok" {
		t.Fatalf("GOOD = %q", env["GOOD"])
	}
	if _, ok := env["BAD"]; ok {
		t.Fatal("BAD should have been skipped")
	}
}

func TestMergeBuildSecretsRenderedReferencesWin(t *testing.T) {
	raw := map[string]string{
		"API_URL":  "${{service.abc.HTTP}}",
		"DB_NAME":  "app",
		"LOG_JSON": "true",
	}
	rendered := map[string]string{
		"API_URL": "https://api.example.com",
		"DB_URL":  "postgres://user:pass@db:5432/app",
	}

	got := mergeBuildSecrets(&config.Config{}, raw, rendered)

	want := map[string]string{
		"API_URL":  "https://api.example.com",
		"DB_NAME":  "app",
		"LOG_JSON": "true",
		"DB_URL":   "postgres://user:pass@db:5432/app",
	}
	if len(got) != len(want) {
		t.Fatalf("got %d entries, want %d: %v", len(got), len(want), got)
	}
	for k, v := range want {
		if got[k] != v {
			t.Errorf("%s = %q, want %q", k, got[k], v)
		}
	}
}

func TestMergeBuildSecretsIncludesRailpackCommands(t *testing.T) {
	cfg := &config.Config{RailpackInstallCommand: "pnpm install", RailpackBuildCommand: "pnpm build"}

	got := mergeBuildSecrets(cfg, map[string]string{"A": "1"}, nil)

	if got["RAILPACK_INSTALL_CMD"] != "pnpm install" {
		t.Errorf("RAILPACK_INSTALL_CMD = %q", got["RAILPACK_INSTALL_CMD"])
	}
	if got["RAILPACK_BUILD_CMD"] != "pnpm build" {
		t.Errorf("RAILPACK_BUILD_CMD = %q", got["RAILPACK_BUILD_CMD"])
	}
	if got["A"] != "1" {
		t.Errorf("A = %q", got["A"])
	}
}

func TestMergeBuildSecretsOmitsEmptyRailpackCommands(t *testing.T) {
	got := mergeBuildSecrets(&config.Config{}, nil, nil)
	if len(got) != 0 {
		t.Fatalf("expected no entries, got %v", got)
	}
}
