package k8s

import (
	"context"
	"fmt"
	"io"

	corev1 "k8s.io/api/core/v1"
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

// ExecInPod runs a command in a pod container as the token's user via impersonation,
// so the cluster's RBAC bindings apply as they would for kubectl exec.
func (self *KubeClient) ExecInPod(ctx context.Context, token string, opts ExecOptions) error {
	claims, err := self.tokenVerifier.Verify(token)
	if err != nil {
		return err
	}

	cfg := self.impersonationConfig(claims.Email, claims.Groups)
	client, err := kubernetes.NewForConfig(cfg)
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

	wsExec, err := remotecommand.NewWebSocketExecutor(cfg, "GET", execURL.String())
	if err != nil {
		return fmt.Errorf("failed to build websocket executor: %w", err)
	}

	spdyExec, err := remotecommand.NewSPDYExecutor(cfg, "POST", execURL)
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
