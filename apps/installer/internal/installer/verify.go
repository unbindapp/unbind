package installer

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// fatalWaitingReasons are container waiting states that do not recover on their
// own, so verification should fail on them quickly instead of waiting out the
// whole timeout (e.g. a missing image will never appear).
var fatalWaitingReasons = map[string]bool{
	"ImagePullBackOff":           true,
	"ErrImagePull":               true,
	"InvalidImageName":           true,
	"CrashLoopBackOff":           true,
	"CreateContainerConfigError": true,
}

// VerifyWorkloadsHealthy waits until every Deployment and StatefulSet in the
// namespace reaches its desired ready replicas. helmfile syncs with wait=false,
// so without this the installer would report success while pods are still pulling,
// crash-looping, or failing to pull their image. A pod stuck in an unrecoverable
// state fails verification quickly with the real reason.
func (self *UnbindInstaller) VerifyWorkloadsHealthy(ctx context.Context, dependencyName, namespace string, timeout time.Duration) error {
	const (
		pollInterval = 8 * time.Second
		fatalGrace   = 75 * time.Second
	)

	deadline := time.Now().Add(timeout)
	fatalSince := map[string]time.Time{}

	for {
		notReady, fatal, err := self.collectWorkloadHealth(ctx, namespace)
		if err != nil {
			self.sendLog("Health check query failed, retrying: " + err.Error())
		} else if len(notReady) == 0 {
			self.logProgress(dependencyName, 0.98, "All components are healthy", nil, StatusInstalling)
			return nil
		}

		if stuck := persistentlyStuck(fatal, fatalSince, fatalGrace); len(stuck) > 0 {
			return fmt.Errorf("components failed to start: %s", strings.Join(stuck, "; "))
		}

		if time.Now().After(deadline) {
			return fmt.Errorf("timed out waiting for components to become healthy: %s", healthDetail(notReady, fatal))
		}

		sort.Strings(notReady)
		self.logProgress(dependencyName, 0.93, "Waiting for components: "+strings.Join(notReady, ", "), nil, StatusInstalling)

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(pollInterval):
		}
	}
}

// collectWorkloadHealth returns the workloads not yet at their desired ready
// replica count, plus a map of pod name -> unrecoverable waiting reason.
func (self *UnbindInstaller) collectWorkloadHealth(ctx context.Context, namespace string) (notReady []string, fatal map[string]string, err error) {
	fatal = map[string]string{}

	deploys, err := self.kubeClient.AppsV1().Deployments(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, nil, err
	}
	for _, d := range deploys.Items {
		if d.Status.ReadyReplicas < desiredReplicas(d.Spec.Replicas) {
			notReady = append(notReady, "deployment/"+d.Name)
		}
	}

	sets, err := self.kubeClient.AppsV1().StatefulSets(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, nil, err
	}
	for _, s := range sets.Items {
		if s.Status.ReadyReplicas < desiredReplicas(s.Spec.Replicas) {
			notReady = append(notReady, "statefulset/"+s.Name)
		}
	}

	pods, err := self.kubeClient.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, nil, err
	}
	for _, p := range pods.Items {
		for _, cs := range p.Status.ContainerStatuses {
			if cs.State.Waiting != nil && fatalWaitingReasons[cs.State.Waiting.Reason] {
				fatal[p.Name] = cs.State.Waiting.Reason
			}
		}
	}

	return notReady, fatal, nil
}

func desiredReplicas(replicas *int32) int32 {
	if replicas == nil {
		return 1
	}
	return *replicas
}

// persistentlyStuck returns pods that have held an unrecoverable state for longer
// than grace, tracking first-seen times in fatalSince across polls.
func persistentlyStuck(fatal map[string]string, fatalSince map[string]time.Time, grace time.Duration) []string {
	now := time.Now()
	for pod := range fatalSince {
		if _, ok := fatal[pod]; !ok {
			delete(fatalSince, pod)
		}
	}

	var stuck []string
	for pod, reason := range fatal {
		if _, ok := fatalSince[pod]; !ok {
			fatalSince[pod] = now
		}
		if now.Sub(fatalSince[pod]) >= grace {
			stuck = append(stuck, fmt.Sprintf("%s (%s)", pod, reason))
		}
	}
	sort.Strings(stuck)
	return stuck
}

func healthDetail(notReady []string, fatal map[string]string) string {
	if len(fatal) > 0 {
		var reasons []string
		for pod, reason := range fatal {
			reasons = append(reasons, fmt.Sprintf("%s (%s)", pod, reason))
		}
		sort.Strings(reasons)
		return strings.Join(reasons, "; ")
	}
	sort.Strings(notReady)
	return strings.Join(notReady, ", ")
}
