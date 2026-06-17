package k8s

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/models"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// RegistryCredential represents credentials for a single registry
type RegistryCredential struct {
	RegistryURL string
	Username    string
	Password    string
}

// CreateMultiRegistryCredentials creates or updates a kubernetes.io/dockerconfigjson secret for multiple container registries
func (self *KubeClient) CreateMultiRegistryCredentials(ctx context.Context, name, namespace string,
	credentials []RegistryCredential, client kubernetes.Interface) (*corev1.Secret, error) {

	type DockerConfigEntry struct {
		Username string `json:"username,omitempty"`
		Password string `json:"password,omitempty"`
		Auth     string `json:"auth,omitempty"`
	}

	type DockerConfigJSON struct {
		Auths map[string]DockerConfigEntry `json:"auths"`
	}

	// Initialize docker config with empty auths map
	dockerConfig := DockerConfigJSON{
		Auths: make(map[string]DockerConfigEntry),
	}

	// Add each registry credential to the config
	for _, cred := range credentials {
		// Create auth string (base64 encoded username:password)
		auth := base64.StdEncoding.EncodeToString([]byte(cred.Username + ":" + cred.Password))

		registryURL := cred.RegistryURL
		if registryURL == "docker.io" {
			// Docker Hub uses this specific auth endpoint
			registryURL = "https://index.docker.io/v1/"
		}

		// Add to docker config
		dockerConfig.Auths[registryURL] = DockerConfigEntry{
			Username: cred.Username,
			Password: cred.Password,
			Auth:     auth,
		}
	}

	dockerConfigJSON, err := json.Marshal(dockerConfig)
	if err != nil {
		return nil, err
	}

	// Check if secret already exists
	secret, err := self.GetSecret(ctx, name, namespace, client)
	if err != nil && !apierrors.IsNotFound(err) {
		return nil, err
	}

	// Create or update the secret
	if apierrors.IsNotFound(err) {
		// Create new secret
		newSecret := &corev1.Secret{
			ObjectMeta: metav1.ObjectMeta{
				Name:      name,
				Namespace: namespace,
			},
			Type: corev1.SecretTypeDockerConfigJson,
			Data: map[string][]byte{
				corev1.DockerConfigJsonKey: dockerConfigJSON,
			},
		}
		return client.CoreV1().Secrets(namespace).Create(ctx, newSecret, metav1.CreateOptions{})
	} else {
		// Update existing secret
		secret.Type = corev1.SecretTypeDockerConfigJson
		if secret.Data == nil {
			secret.Data = make(map[string][]byte)
		}
		secret.Data[corev1.DockerConfigJsonKey] = dockerConfigJSON
		return client.CoreV1().Secrets(namespace).Update(ctx, secret, metav1.UpdateOptions{})
	}
}

// After you've retrieved the credentials Secret
func (self *KubeClient) ParseRegistryCredentials(secret *corev1.Secret) (string, string, error) {
	// Check if this is a dockerconfigjson type secret
	if dockerConfigJSON, ok := secret.Data[".dockerconfigjson"]; ok {
		// Parse the Docker config JSON
		var dockerConfig struct {
			Auths map[string]struct {
				Username string `json:"username"`
				Password string `json:"password"`
				Auth     string `json:"auth,omitempty"`
			} `json:"auths"`
		}

		if err := json.Unmarshal(dockerConfigJSON, &dockerConfig); err != nil {
			return "", "", fmt.Errorf("failed to parse Docker config JSON: %w", err)
		}

		// Just grab the first auth entry (assuming there's only one registry)
		for _, auth := range dockerConfig.Auths {
			return auth.Username, auth.Password, nil
		}

		return "", "", fmt.Errorf("no registry credentials found in Docker config")
	}

	// Direct username/password fields
	usernameBytes, hasUsername := secret.Data["username"]
	passwordBytes, hasPassword := secret.Data["password"]

	if !hasUsername || !hasPassword {
		return "", "", fmt.Errorf("secret is missing username or password fields")
	}

	username := string(usernameBytes)
	password := string(passwordBytes)

	return username, password, nil
}

// Now you can use username and password

// GetOrCreateSecret retrieves an existing secret or creates a new one if it doesn't exist
// Returns the secret and a boolean indicating if it was created (true) or retrieved (false)
func (self *KubeClient) GetOrCreateSecret(ctx context.Context, name, namespace string, client kubernetes.Interface) (*corev1.Secret, bool, error) {
	secret, err := self.GetSecret(ctx, name, namespace, client)
	if err != nil {
		if apierrors.IsNotFound(err) {
			// Secret doesn't exist, create it
			secret = &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name:      name,
					Namespace: namespace,
				},
				Type: corev1.SecretTypeOpaque,
				Data: make(map[string][]byte),
			}

			createdSecret, createErr := client.CoreV1().Secrets(namespace).Create(ctx, secret, metav1.CreateOptions{})
			if createErr != nil {
				return nil, false, createErr
			}
			return createdSecret, true, nil
		}
		return nil, false, err
	}

	// Secret exists
	return secret, false, nil
}

// GetSecret retrieves a secret by name in the given namespace
func (self *KubeClient) GetSecret(ctx context.Context, name, namespace string, client kubernetes.Interface) (*corev1.Secret, error) {
	return client.CoreV1().Secrets(namespace).Get(ctx, name, metav1.GetOptions{})
}

// UpdateSecret updates an existing secret with new data
func (self *KubeClient) UpdateSecret(ctx context.Context, name, namespace string, data map[string][]byte, client kubernetes.Interface) (*corev1.Secret, error) {
	secret, err := self.GetSecret(ctx, name, namespace, client)
	if err != nil {
		return nil, err
	}

	// Update the data
	secret.Data = data

	return client.CoreV1().Secrets(namespace).Update(ctx, secret, metav1.UpdateOptions{})
}

// GetSecretValue retrieves a specific key from a secret
func (self *KubeClient) GetSecretValue(ctx context.Context, name, namespace, key string, client kubernetes.Interface) ([]byte, error) {
	secret, err := self.GetSecret(ctx, name, namespace, client)
	if err != nil {
		return nil, err
	}

	if value, exists := secret.Data[key]; exists {
		return value, nil
	}

	return nil, fmt.Errorf("key %s not found in secret %s", key, name)
}

// GetSecretMap retrieves all key-value pairs from a secret as a map
func (self *KubeClient) GetSecretMap(ctx context.Context, name, namespace string, client kubernetes.Interface) (map[string][]byte, error) {
	secret, err := self.GetSecret(ctx, name, namespace, client)
	if err != nil {
		return nil, err
	}

	return secret.Data, nil
}

// DeleteSecret deletes a secret by name in the given namespace
func (self *KubeClient) DeleteSecret(ctx context.Context, name, namespace string, client kubernetes.Interface) error {
	return client.CoreV1().Secrets(namespace).Delete(ctx, name, metav1.DeleteOptions{})
}

// UpsertSecretValues adds or updates specific keys in a secret without affecting other keys
func (self *KubeClient) UpsertSecretValues(ctx context.Context, name, namespace string, values map[string][]byte, client kubernetes.Interface) (*corev1.Secret, error) {
	// Get the current secret
	secret, err := self.GetSecret(ctx, name, namespace, client)
	if err != nil {
		return nil, err
	}

	// If the data map is nil, initialize it
	if secret.Data == nil {
		secret.Data = make(map[string][]byte)
	}

	// Update the values
	for k, v := range values {
		secret.Data[k] = v
	}

	return client.CoreV1().Secrets(namespace).Update(ctx, secret, metav1.UpdateOptions{})
}

// OverwriteSecretValues overwrites all values in a secret with new values
func (self *KubeClient) OverwriteSecretValues(ctx context.Context, name, namespace string, values map[string][]byte, client kubernetes.Interface) (*corev1.Secret, error) {
	secret, err := self.GetSecret(ctx, name, namespace, client)
	if err != nil {
		return nil, err
	}

	// Reset values
	secret.Data = make(map[string][]byte)

	// Set the values
	for k, v := range values {
		secret.Data[k] = v
	}

	return client.CoreV1().Secrets(namespace).Update(ctx, secret, metav1.UpdateOptions{})
}

// GetAllSecrets retrieves all secrets for the team hierarchy concurrently and returns them with just their keys
func (self *KubeClient) GetAllSecrets(
	ctx context.Context,
	teamID uuid.UUID,
	teamSecret string,
	projectID uuid.UUID,
	projectSecret string,
	environmentID uuid.UUID,
	environmentSecret string,
	serviceSecrets map[uuid.UUID]string,
	client kubernetes.Interface,
	namespace string,
) ([]models.SecretData, error) {
	var wg sync.WaitGroup
	var mu sync.Mutex
	var result []models.SecretData
	var errOnce sync.Once
	var firstErr error

	// Process team secret
	if teamSecret != "" {
		wg.Add(1)
		go func() {
			defer wg.Done()
			secretData, err := self.processSecretKeys(ctx, teamID, schema.VariableReferenceSourceTypeTeam, teamSecret, client, namespace)
			if err != nil {
				errOnce.Do(func() {
					firstErr = err
				})
				return
			}
			mu.Lock()
			result = append(result, secretData)
			mu.Unlock()
		}()
	}

	// Process project secret
	if projectSecret != "" {
		wg.Add(1)
		go func() {
			defer wg.Done()
			secretData, err := self.processSecretKeys(ctx, projectID, schema.VariableReferenceSourceTypeProject, projectSecret, client, namespace)
			if err != nil {
				errOnce.Do(func() {
					firstErr = err
				})
				return
			}
			mu.Lock()
			result = append(result, secretData)
			mu.Unlock()
		}()
	}

	// Process environment secret
	if environmentSecret != "" {
		wg.Add(1)
		go func() {
			defer wg.Done()
			secretData, err := self.processSecretKeys(ctx, environmentID, schema.VariableReferenceSourceTypeEnvironment, environmentSecret, client, namespace)
			if err != nil {
				errOnce.Do(func() {
					firstErr = err
				})
				return
			}
			mu.Lock()
			result = append(result, secretData)
			mu.Unlock()
		}()
	}

	// Process service secrets
	for serviceID, secretName := range serviceSecrets {
		if secretName == "" {
			continue
		}
		wg.Add(1)
		go func(id uuid.UUID, name string) {
			defer wg.Done()
			secretData, err := self.processSecretKeys(ctx, id, schema.VariableReferenceSourceTypeService, name, client, namespace)
			if err != nil {
				errOnce.Do(func() {
					firstErr = err
				})
				return
			}
			mu.Lock()
			result = append(result, secretData)
			mu.Unlock()
		}(serviceID, secretName)
	}

	// Wait for all goroutines to finish
	wg.Wait()

	// Check if any error occurred
	if firstErr != nil {
		return nil, firstErr
	}

	return result, nil
}

// Helper function to process a single secret and extract just its keys
// This function remains unchanged from your original
func (self *KubeClient) processSecretKeys(
	ctx context.Context,
	id uuid.UUID,
	secretType schema.VariableReferenceSourceType,
	secretName string,
	client kubernetes.Interface,
	namespace string,
) (models.SecretData, error) {
	// Get the secret
	secret, err := self.GetSecret(ctx, secretName, namespace, client)
	if err != nil {
		if apierrors.IsNotFound(err) {
			// If secret doesn't exist, return an empty keys slice
			return models.SecretData{
				ID:         id,
				Type:       secretType,
				SecretName: secretName,
				Keys:       []string{},
			}, nil
		}
		return models.SecretData{}, err
	}

	// Extract just the keys from the secret's data
	keys := make([]string, len(secret.Data))
	i := 0
	for k := range secret.Data {
		keys[i] = k
		i++
	}

	// Return the secret with just its keys
	return models.SecretData{
		ID:         id,
		Type:       secretType,
		SecretName: secretName,
		Keys:       keys,
	}, nil
}

// CopySecret copies a secret from one namespace to another
func (self *KubeClient) CopySecret(ctx context.Context, secretName string,
	sourceNamespace string, targetNamespace string,
	client kubernetes.Interface) (*corev1.Secret, error) {

	targetSecretName := secretName

	// Get the source secret
	sourceSecret, err := self.GetSecret(ctx, secretName, sourceNamespace, client)
	if err != nil {
		return nil, fmt.Errorf("failed to get source secret from %s namespace: %w", sourceNamespace, err)
	}

	// Create a new secret with the same data but in the target namespace
	newSecret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:        targetSecretName,
			Namespace:   targetNamespace,
			Labels:      sourceSecret.Labels,      // Copy labels
			Annotations: sourceSecret.Annotations, // Copy annotations
		},
		Type: sourceSecret.Type,
		Data: sourceSecret.Data,
	}

	// Try to create the secret in the target namespace
	createdSecret, err := client.CoreV1().Secrets(targetNamespace).Create(ctx, newSecret, metav1.CreateOptions{})
	if err != nil {
		// If secret already exists, update it instead
		if apierrors.IsAlreadyExists(err) {
			existingSecret, err := self.GetSecret(ctx, targetSecretName, targetNamespace, client)
			if err != nil {
				return nil, fmt.Errorf("error getting existing secret in target namespace: %w", err)
			}

			// Update the existing secret
			existingSecret.Type = sourceSecret.Type
			existingSecret.Data = sourceSecret.Data
			existingSecret.Labels = sourceSecret.Labels
			existingSecret.Annotations = sourceSecret.Annotations

			return client.CoreV1().Secrets(targetNamespace).Update(ctx, existingSecret, metav1.UpdateOptions{})
		}
		return nil, fmt.Errorf("failed to create secret in target namespace: %w", err)
	}

	return createdSecret, nil
}
