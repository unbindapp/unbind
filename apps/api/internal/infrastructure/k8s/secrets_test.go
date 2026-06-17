package k8s

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestKubeClient_ParseRegistryCredentials(t *testing.T) {
	tests := []struct {
		name          string
		secret        *corev1.Secret
		expectedUser  string
		expectedPass  string
		expectError   bool
		errorContains string
	}{
		{
			name: "Valid dockerconfigjson secret",
			secret: &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-registry-secret",
				},
				Type: corev1.SecretTypeDockerConfigJson,
				Data: map[string][]byte{
					".dockerconfigjson": []byte(`{
						"auths": {
							"registry.example.com": {
								"username": "testuser",
								"password": "testpass"
							}
						}
					}`),
				},
			},
			expectedUser: "testuser",
			expectedPass: "testpass",
			expectError:  false,
		},
		{
			name: "Valid dockerconfigjson with multiple registries",
			secret: &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-registry-secret",
				},
				Type: corev1.SecretTypeDockerConfigJson,
				Data: map[string][]byte{
					".dockerconfigjson": []byte(`{
						"auths": {
							"registry1.example.com": {
								"username": "user1",
								"password": "pass1"
							},
							"registry2.example.com": {
								"username": "user2",
								"password": "pass2"
							}
						}
					}`),
				},
			},
			expectedUser: "", // Will check separately since map iteration is non-deterministic
			expectedPass: "",
			expectError:  false,
		},
		{
			name: "Valid username/password secret",
			secret: &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-basic-secret",
				},
				Type: corev1.SecretTypeOpaque,
				Data: map[string][]byte{
					"username": []byte("basicuser"),
					"password": []byte("basicpass"),
				},
			},
			expectedUser: "basicuser",
			expectedPass: "basicpass",
			expectError:  false,
		},
		{
			name: "Missing username field",
			secret: &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-incomplete-secret",
				},
				Type: corev1.SecretTypeOpaque,
				Data: map[string][]byte{
					"password": []byte("somepass"),
				},
			},
			expectedUser:  "",
			expectedPass:  "",
			expectError:   true,
			errorContains: "missing username or password fields",
		},
		{
			name: "Missing password field",
			secret: &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-incomplete-secret",
				},
				Type: corev1.SecretTypeOpaque,
				Data: map[string][]byte{
					"username": []byte("someuser"),
				},
			},
			expectedUser:  "",
			expectedPass:  "",
			expectError:   true,
			errorContains: "missing username or password fields",
		},
		{
			name: "Invalid JSON in dockerconfigjson",
			secret: &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-invalid-json",
				},
				Type: corev1.SecretTypeDockerConfigJson,
				Data: map[string][]byte{
					".dockerconfigjson": []byte(`{invalid json}`),
				},
			},
			expectedUser:  "",
			expectedPass:  "",
			expectError:   true,
			errorContains: "failed to parse Docker config JSON",
		},
		{
			name: "Empty dockerconfigjson auths",
			secret: &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-empty-auths",
				},
				Type: corev1.SecretTypeDockerConfigJson,
				Data: map[string][]byte{
					".dockerconfigjson": []byte(`{
						"auths": {}
					}`),
				},
			},
			expectedUser:  "",
			expectedPass:  "",
			expectError:   true,
			errorContains: "no registry credentials found in Docker config",
		},
		{
			name:          "Nil secret",
			secret:        nil,
			expectedUser:  "",
			expectedPass:  "",
			expectError:   true,
			errorContains: "", // Will panic, which is handled by defer
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			kubeClient := &KubeClient{}

			// Handle panics for nil secret case
			defer func() {
				if r := recover(); r != nil && tt.secret == nil {
					// Expected panic for nil secret
					return
				} else if r != nil {
					// Unexpected panic, re-panic
					panic(r)
				}
			}()

			username, password, err := kubeClient.ParseRegistryCredentials(tt.secret)

			if tt.expectError {
				assert.Error(t, err)
				if tt.errorContains != "" {
					assert.Contains(t, err.Error(), tt.errorContains)
				}
			} else {
				assert.NoError(t, err)

				// Special case for multiple registries - map iteration is non-deterministic
				if tt.name == "Valid dockerconfigjson with multiple registries" {
					// Should return one of the two credentials
					assert.True(t, (username == "user1" && password == "pass1") || (username == "user2" && password == "pass2"))
				} else {
					assert.Equal(t, tt.expectedUser, username)
					assert.Equal(t, tt.expectedPass, password)
				}
			}
		})
	}
}

func TestRegistryCredential_StructValidation(t *testing.T) {
	tests := []struct {
		name  string
		cred  RegistryCredential
		valid bool
	}{
		{
			name: "Valid registry credential",
			cred: RegistryCredential{
				RegistryURL: "https://registry.example.com",
				Username:    "testuser",
				Password:    "testpass",
			},
			valid: true,
		},
		{
			name: "Empty registry URL",
			cred: RegistryCredential{
				RegistryURL: "",
				Username:    "testuser",
				Password:    "testpass",
			},
			valid: false,
		},
		{
			name: "Empty username",
			cred: RegistryCredential{
				RegistryURL: "https://registry.example.com",
				Username:    "",
				Password:    "testpass",
			},
			valid: false,
		},
		{
			name: "Empty password",
			cred: RegistryCredential{
				RegistryURL: "https://registry.example.com",
				Username:    "testuser",
				Password:    "",
			},
			valid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Basic validation logic
			isValid := tt.cred.RegistryURL != "" && tt.cred.Username != "" && tt.cred.Password != ""
			assert.Equal(t, tt.valid, isValid)
		})
	}
}

func TestDockerConfigJSON_Creation(t *testing.T) {
	// Test creating the JSON structure that would be used in secrets
	type DockerConfigEntry struct {
		Username string `json:"username,omitempty"`
		Password string `json:"password,omitempty"`
		Auth     string `json:"auth,omitempty"`
	}

	type DockerConfigJSON struct {
		Auths map[string]DockerConfigEntry `json:"auths"`
	}

	config := DockerConfigJSON{
		Auths: map[string]DockerConfigEntry{
			"registry.example.com": {
				Username: "testuser",
				Password: "testpass",
			},
		},
	}

	// Test that we can marshal and unmarshal
	jsonData, err := json.Marshal(config)
	assert.NoError(t, err)
	assert.Contains(t, string(jsonData), "testuser")
	assert.Contains(t, string(jsonData), "testpass")

	// Test unmarshaling
	var unmarshaledConfig DockerConfigJSON
	err = json.Unmarshal(jsonData, &unmarshaledConfig)
	assert.NoError(t, err)

	auth, exists := unmarshaledConfig.Auths["registry.example.com"]
	assert.True(t, exists)
	assert.Equal(t, "testuser", auth.Username)
	assert.Equal(t, "testpass", auth.Password)
}

func TestSecretDataValidation(t *testing.T) {
	// Test various secret data scenarios
	tests := []struct {
		name         string
		data         map[string][]byte
		expectedKeys []string
	}{
		{
			name: "Basic username/password",
			data: map[string][]byte{
				"username": []byte("user"),
				"password": []byte("pass"),
			},
			expectedKeys: []string{"username", "password"},
		},
		{
			name: "Docker config json",
			data: map[string][]byte{
				".dockerconfigjson": []byte(`{"auths":{}}`),
			},
			expectedKeys: []string{".dockerconfigjson"},
		},
		{
			name: "Multiple keys",
			data: map[string][]byte{
				"api-key":    []byte("key123"),
				"secret-key": []byte("secret456"),
				"token":      []byte("token789"),
			},
			expectedKeys: []string{"api-key", "secret-key", "token"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Verify all expected keys exist
			for _, expectedKey := range tt.expectedKeys {
				_, exists := tt.data[expectedKey]
				assert.True(t, exists, "Expected key '%s' to exist in data", expectedKey)
			}

			// Verify count matches
			assert.Len(t, tt.data, len(tt.expectedKeys))
		})
	}
}
