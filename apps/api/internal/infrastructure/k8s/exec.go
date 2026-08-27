package k8s

import (
	"context"
	"fmt"
	"io"

	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	authorizationv1 "k8s.io/api/authorization/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/tools/remotecommand"
	"k8s.io/streaming/pkg/httpstream"
)

type ExecOptions struct {
	Namespace string
	PodName   string
	Container string
	Command   []string
	TTY       bool
	Stdin     io.Reader
	Stdout    io.Writer
	Stderr    io.Writer
	Resize    remotecommand.TerminalSizeQueue
}

// ExecInPod runs a command in a pod container after checking that the token's user is
// allowed to exec there, per the RBAC bindings synced from the user's permissions.
func (self *KubeClient) ExecInPod(ctx context.Context, token string, opts ExecOptions) error {
	claims, err := self.tokenVerifier.Verify(token)
	if err != nil {
		return err
	}

	if err := self.authorizePodExec(ctx, claims.Email, claims.Groups, opts.Namespace, opts.PodName); err != nil {
		return err
	}

	client, err := kubernetes.NewForConfig(self.baseConfig)
	if err != nil {
		return fmt.Errorf("failed to build exec client: %w", err)
	}

	req := client.CoreV1().RESTClient().
		Post().
		Resource("pods").
		Name(opts.PodName).
		Namespace(opts.Namespace).
		SubResource("exec").
		VersionedParams(&corev1.PodExecOptions{
			Container: opts.Container,
			Command:   opts.Command,
			Stdin:     opts.Stdin != nil,
			Stdout:    opts.Stdout != nil,
			Stderr:    opts.Stderr != nil,
			TTY:       opts.TTY,
		}, scheme.ParameterCodec)

	execURL := req.URL()

	wsExec, err := remotecommand.NewWebSocketExecutor(self.baseConfig, "GET", execURL.String())
	if err != nil {
		return fmt.Errorf("failed to build websocket executor: %w", err)
	}

	spdyExec, err := remotecommand.NewSPDYExecutor(self.baseConfig, "POST", execURL)
	if err != nil {
		return fmt.Errorf("failed to build spdy executor: %w", err)
	}

	exec, err := remotecommand.NewFallbackExecutor(wsExec, spdyExec, httpstream.IsUpgradeFailure)
	if err != nil {
		return fmt.Errorf("failed to build exec: %w", err)
	}

	return exec.StreamWithContext(ctx, remotecommand.StreamOptions{
		Stdin:             opts.Stdin,
		Stdout:            opts.Stdout,
		Stderr:            opts.Stderr,
		Tty:               opts.TTY,
		TerminalSizeQueue: opts.Resize,
	})
}

func (self *KubeClient) authorizePodExec(ctx context.Context, user string, groups []string, namespace, podName string) error {
	review := &authorizationv1.SubjectAccessReview{
		Spec: authorizationv1.SubjectAccessReviewSpec{
			User:   user,
			Groups: groups,
			ResourceAttributes: &authorizationv1.ResourceAttributes{
				Namespace:   namespace,
				Verb:        "create",
				Resource:    "pods",
				Subresource: "exec",
				Name:        podName,
			},
		},
	}

	result, err := self.clientset.AuthorizationV1().SubjectAccessReviews().Create(ctx, review, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("failed to check exec authorization: %w", err)
	}
	if !result.Status.Allowed {
		return fmt.Errorf("%w: not allowed to exec into pod %s/%s", errdefs.ErrUnauthorized, namespace, podName)
	}
	return nil
}
