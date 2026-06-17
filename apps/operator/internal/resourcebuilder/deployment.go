package resourcebuilder

import (
	"fmt"
	"strings"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
)

var ErrDeploymentNotNeeded = fmt.Errorf("deployment not needed, probably no image configured")

func (rb *ResourceBuilder) BuildDeployment() (*appsv1.Deployment, error) {
	if rb.service.Spec.Config.Image == "" {
		return nil, ErrDeploymentNotNeeded
	}

	replicas := int32(1)
	if rb.service.Spec.Config.Replicas != nil {
		replicas = *rb.service.Spec.Config.Replicas
	}

	strategy := rb.buildDeploymentStrategy()
	volumes, volumeMounts := rb.buildVolumes()
	container := rb.buildMainContainer(volumeMounts)
	initContainers := rb.buildInitContainers(container.Resources, volumeMounts)
	imagePullSecrets := rb.buildImagePullSecrets()

	return &appsv1.Deployment{
		ObjectMeta: rb.buildObjectMeta(),
		Spec: appsv1.DeploymentSpec{
			Replicas: &replicas,
			Strategy: strategy,
			Selector: &metav1.LabelSelector{
				MatchLabels: rb.getLabelSelectors(),
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels:      rb.getCommonLabels(),
					Annotations: rb.buildPodAnnotations(),
				},
				Spec: corev1.PodSpec{
					ImagePullSecrets: imagePullSecrets,
					InitContainers:   initContainers,
					Containers:       []corev1.Container{container},
					Volumes:          volumes,
				},
			},
		},
	}, nil
}

func (rb *ResourceBuilder) buildDeploymentStrategy() appsv1.DeploymentStrategy {
	if len(rb.service.Spec.Config.Volumes) > 0 {
		return appsv1.DeploymentStrategy{Type: appsv1.RecreateDeploymentStrategyType}
	}
	return appsv1.DeploymentStrategy{Type: appsv1.RollingUpdateDeploymentStrategyType}
}

func (rb *ResourceBuilder) buildMainContainer(volumeMounts []corev1.VolumeMount) corev1.Container {
	ports := make([]corev1.ContainerPort, 0, len(rb.service.Spec.Config.Ports))
	for _, port := range rb.service.Spec.Config.Ports {
		ports = append(ports, corev1.ContainerPort{ContainerPort: port.Port})
	}

	container := corev1.Container{
		Name:            rb.service.Name,
		Image:           rb.service.Spec.Config.Image,
		ImagePullPolicy: corev1.PullAlways,
		Ports:           ports,
		EnvFrom: []corev1.EnvFromSource{{
			SecretRef: &corev1.SecretEnvSource{
				LocalObjectReference: corev1.LocalObjectReference{Name: rb.service.Spec.KubernetesSecret},
			},
		}},
		Env:             rb.service.Spec.EnvVars,
		SecurityContext: rb.service.Spec.SecurityContext,
		VolumeMounts:    volumeMounts,
		Resources:       rb.buildResourceRequirements(),
	}

	if rb.service.Spec.Config.HealthCheck != nil {
		container.LivenessProbe = rb.buildLivenessProbe()
		container.ReadinessProbe = rb.buildReadinessProbe()
		container.StartupProbe = rb.buildStartupProbe()
	}

	applyCommand(&container, rb.service.Spec.Config.RunCommand)
	return container
}

func (rb *ResourceBuilder) buildVolumes() ([]corev1.Volume, []corev1.VolumeMount) {
	totalSize := len(rb.service.Spec.Config.Volumes) + len(rb.service.Spec.Config.VariableMounts)
	volumes := make([]corev1.Volume, 0, totalSize)
	mounts := make([]corev1.VolumeMount, 0, totalSize)

	for _, vol := range rb.service.Spec.Config.Volumes {
		mounts = append(mounts, corev1.VolumeMount{Name: vol.Name, MountPath: vol.MountPath})
		volumes = append(volumes, corev1.Volume{
			Name: vol.Name,
			VolumeSource: corev1.VolumeSource{
				PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{ClaimName: vol.Name},
			},
		})
	}

	for i, vm := range rb.service.Spec.Config.VariableMounts {
		volumeName := fmt.Sprintf("var-mount-%d", i)
		mounts = append(mounts, corev1.VolumeMount{Name: volumeName, MountPath: vm.Path, SubPath: vm.Name})
		volumes = append(volumes, corev1.Volume{
			Name: volumeName,
			VolumeSource: corev1.VolumeSource{
				Secret: &corev1.SecretVolumeSource{
					SecretName: rb.service.Spec.KubernetesSecret,
					Items:      []corev1.KeyToPath{{Key: vm.Name, Path: vm.Name}},
				},
			},
		})
	}

	return volumes, mounts
}

func (rb *ResourceBuilder) buildResourceRequirements() corev1.ResourceRequirements {
	res := rb.service.Spec.Config.Resources
	if res == nil {
		return corev1.ResourceRequirements{}
	}

	reqs := corev1.ResourceRequirements{}
	if res.CPURequestsMillicores > 0 || res.MemoryRequestsMegabytes > 0 {
		reqs.Requests = corev1.ResourceList{}
	}
	if res.CPULimitsMillicores > 0 || res.MemoryLimitsMegabytes > 0 {
		reqs.Limits = corev1.ResourceList{}
	}

	if res.CPURequestsMillicores > 0 {
		reqs.Requests[corev1.ResourceCPU] = *resource.NewMilliQuantity(res.CPURequestsMillicores, resource.DecimalSI)
	}
	if res.CPULimitsMillicores > 0 {
		reqs.Limits[corev1.ResourceCPU] = *resource.NewMilliQuantity(res.CPULimitsMillicores, resource.DecimalSI)
	}
	if res.MemoryRequestsMegabytes > 0 {
		reqs.Requests[corev1.ResourceMemory] = *resource.NewQuantity(res.MemoryRequestsMegabytes*1000*1000, resource.DecimalSI)
	}
	if res.MemoryLimitsMegabytes > 0 {
		reqs.Limits[corev1.ResourceMemory] = *resource.NewQuantity(res.MemoryLimitsMegabytes*1000*1000, resource.DecimalSI)
	}

	return reqs
}

func (rb *ResourceBuilder) buildInitContainers(resources corev1.ResourceRequirements, volumeMounts []corev1.VolumeMount) []corev1.Container {
	initContainers := make([]corev1.Container, 0, len(rb.service.Spec.Config.InitContainers))
	for i, ic := range rb.service.Spec.Config.InitContainers {
		container := corev1.Container{
			Name:            fmt.Sprintf("%s-init-%d", rb.service.Name, i),
			Image:           ic.Image,
			ImagePullPolicy: corev1.PullAlways,
			Resources:       resources,
			VolumeMounts:    volumeMounts,
			EnvFrom: []corev1.EnvFromSource{{
				SecretRef: &corev1.SecretEnvSource{
					LocalObjectReference: corev1.LocalObjectReference{Name: rb.service.Spec.KubernetesSecret},
				},
			}},
			Env: rb.service.Spec.EnvVars,
		}
		applyCommand(&container, &ic.Command)
		initContainers = append(initContainers, container)
	}
	return initContainers
}

func (rb *ResourceBuilder) buildImagePullSecrets() []corev1.LocalObjectReference {
	secrets := make([]corev1.LocalObjectReference, len(rb.service.Spec.ImagePullSecrets))
	for i, secret := range rb.service.Spec.ImagePullSecrets {
		secrets[i] = corev1.LocalObjectReference{Name: secret}
	}
	return secrets
}

func applyCommand(container *corev1.Container, cmd *string) {
	if cmd == nil || *cmd == "" {
		return
	}
	parsed := parseCommand(*cmd)
	if len(parsed) == 0 {
		return
	}
	if len(parsed) >= 3 && parsed[0] == "/bin/sh" && parsed[1] == "-c" {
		container.Command = parsed
		return
	}
	container.Command = []string{parsed[0]}
	if len(parsed) > 1 {
		container.Args = parsed[1:]
	}
}

// parseCommand handles a command string and returns it in a form suitable for Kubernetes
// It supports nested shell commands with quotes
func parseCommand(cmd string) []string {
	if cmd == "" {
		return []string{}
	}

	// Special case: detect if the command already starts with "sh -c" or "/bin/sh -c"
	// to avoid wrapping an already shell-wrapped command
	shellPrefixes := []string{"sh -c ", "/bin/sh -c ", "bash -c "}
	isAlreadyShellCommand := false

	for _, prefix := range shellPrefixes {
		if strings.HasPrefix(cmd, prefix) {
			isAlreadyShellCommand = true
			break
		}
	}

	// If it's already a shell command, parse it carefully preserving the shell command structure
	if isAlreadyShellCommand {
		// Find the first occurrence of -c and take everything after it as the shell argument
		parts := strings.SplitN(cmd, " -c ", 2)
		if len(parts) == 2 {
			shellCmd := parts[0]
			shellArg := strings.TrimSpace(parts[1])

			// If the shell argument starts and ends with quotes, remove them
			if (strings.HasPrefix(shellArg, "\"") && strings.HasSuffix(shellArg, "\"")) ||
				(strings.HasPrefix(shellArg, "'") && strings.HasSuffix(shellArg, "'")) {
				shellArg = shellArg[1 : len(shellArg)-1]
			}

			return []string{strings.TrimSpace(shellCmd), "-c", shellArg}
		}
	}

	// Check if the command contains shell operators that need a shell
	if strings.Contains(cmd, "&&") || strings.Contains(cmd, "||") ||
		strings.Contains(cmd, "|") || strings.Contains(cmd, ">") ||
		strings.Contains(cmd, "<") {
		// Return a command that uses the shell to interpret the command string
		return []string{"/bin/sh", "-c", cmd}
	}

	// For commands without shell operators, parse while respecting quotes
	var result []string
	var current string
	var inQuotes bool
	var quoteChar rune

	for _, r := range cmd {
		switch {
		case r == '"' || r == '\'':
			if inQuotes && r == quoteChar {
				// End quote
				inQuotes = false
			} else if !inQuotes {
				// Start quote
				inQuotes = true
				quoteChar = r
			} else {
				// Quote character inside different quotes
				current += string(r)
			}
		case r == ' ' && !inQuotes:
			// Space outside quotes - split
			if current != "" {
				result = append(result, current)
				current = ""
			}
		default:
			current += string(r)
		}
	}

	// Add the last part if there is one
	if current != "" {
		result = append(result, current)
	}

	// Remove any remaining quote characters from the arguments
	for i, arg := range result {
		result[i] = strings.Trim(arg, "'\"")
	}

	return result
}

// buildLivenessProbe creates a liveness probe from the health check configuration
func (rb *ResourceBuilder) buildLivenessProbe() *corev1.Probe {
	if rb.service.Spec.Config.HealthCheck == nil {
		return nil
	}

	failureThreshold := int32(3)
	if rb.service.Spec.Config.HealthCheck.HealthFailureThreshold != nil {
		failureThreshold = *rb.service.Spec.Config.HealthCheck.HealthFailureThreshold
	}

	periodSeconds := int32(10)
	if rb.service.Spec.Config.HealthCheck.HealthPeriodSeconds != nil {
		periodSeconds = *rb.service.Spec.Config.HealthCheck.HealthPeriodSeconds
	}

	timeoutSeconds := int32(5)
	if rb.service.Spec.Config.HealthCheck.HealthTimeoutSeconds != nil {
		timeoutSeconds = *rb.service.Spec.Config.HealthCheck.HealthTimeoutSeconds
	}

	return rb.buildProbe(failureThreshold, periodSeconds, timeoutSeconds)
}

// buildReadinessProbe creates a readiness probe from the health check configuration
func (rb *ResourceBuilder) buildReadinessProbe() *corev1.Probe {
	if rb.service.Spec.Config.HealthCheck == nil {
		return nil
	}

	failureThreshold := int32(3)
	if rb.service.Spec.Config.HealthCheck.HealthFailureThreshold != nil {
		failureThreshold = *rb.service.Spec.Config.HealthCheck.HealthFailureThreshold
	}

	periodSeconds := int32(10)
	if rb.service.Spec.Config.HealthCheck.HealthPeriodSeconds != nil {
		periodSeconds = *rb.service.Spec.Config.HealthCheck.HealthPeriodSeconds
	}

	timeoutSeconds := int32(5)
	if rb.service.Spec.Config.HealthCheck.HealthTimeoutSeconds != nil {
		timeoutSeconds = *rb.service.Spec.Config.HealthCheck.HealthTimeoutSeconds
	}

	return rb.buildProbe(failureThreshold, periodSeconds, timeoutSeconds)
}

// buildStartupProbe creates a startup probe from the health check configuration
func (rb *ResourceBuilder) buildStartupProbe() *corev1.Probe {
	if rb.service.Spec.Config.HealthCheck == nil {
		return nil
	}

	failureThreshold := int32(30)
	if rb.service.Spec.Config.HealthCheck.StartupFailureThreshold != nil {
		failureThreshold = *rb.service.Spec.Config.HealthCheck.StartupFailureThreshold
	}

	periodSeconds := int32(3)
	if rb.service.Spec.Config.HealthCheck.StartupPeriodSeconds != nil {
		periodSeconds = *rb.service.Spec.Config.HealthCheck.StartupPeriodSeconds
	}

	timeoutSeconds := int32(5)
	if rb.service.Spec.Config.HealthCheck.StartupTimeoutSeconds != nil {
		timeoutSeconds = *rb.service.Spec.Config.HealthCheck.StartupTimeoutSeconds
	}

	return rb.buildProbe(failureThreshold, periodSeconds, timeoutSeconds)
}

// buildProbe creates a probe with the specified parameters
func (rb *ResourceBuilder) buildProbe(failureThreshold, periodSeconds, timeoutSeconds int32) *corev1.Probe {
	healthCheck := rb.service.Spec.Config.HealthCheck

	probe := &corev1.Probe{
		PeriodSeconds:    periodSeconds,
		TimeoutSeconds:   timeoutSeconds,
		FailureThreshold: failureThreshold,
	}

	switch healthCheck.Type {
	case "http":
		// If no port specified and no ports configured, we can't create a valid HTTP probe
		if healthCheck.Port == nil && len(rb.service.Spec.Config.Ports) == 0 {
			return nil
		}

		port := int32(0)
		if healthCheck.Port != nil {
			port = *healthCheck.Port
		} else if len(rb.service.Spec.Config.Ports) > 0 {
			port = rb.service.Spec.Config.Ports[0].Port
		}

		path := "/health"
		if healthCheck.Path != "" {
			path = healthCheck.Path
		}

		probe.HTTPGet = &corev1.HTTPGetAction{
			Path: path,
			Port: intstr.FromInt(int(port)),
		}

	case "exec":
		if healthCheck.Command == "" {
			return nil // No command specified, skip the probe
		}

		command := parseCommand(healthCheck.Command)
		if len(command) == 0 {
			return nil // Empty command after parsing, skip the probe
		}

		probe.Exec = &corev1.ExecAction{
			Command: command,
		}

	default:
		// Unknown type, skip the probe
		return nil
	}

	return probe
}
