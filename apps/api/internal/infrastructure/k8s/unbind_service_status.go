package k8s

import (
	"context"
	"fmt"

	unbindv1 "github.com/unbindapp/unbind-operator/api/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

var servicesGVR = schema.GroupVersionResource{
	Group:    "unbind.unbind.app",
	Version:  "v1",
	Resource: "services",
}

// UnbindServiceState is what the API reads back from a Service CR
type UnbindServiceState struct {
	// Generation of the spec, conditions observed at an older one describe an older spec
	Generation int64
	Status     unbindv1.ServiceStatus
}

func (self *KubeClient) GetUnbindServiceState(ctx context.Context, namespace, name string) (*UnbindServiceState, error) {
	obj, err := self.client.Resource(servicesGVR).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	return unbindServiceState(obj)
}

// ListUnbindServiceStates returns the state of every Service CR in the namespace by name
func (self *KubeClient) ListUnbindServiceStates(ctx context.Context, namespace string) (map[string]*UnbindServiceState, error) {
	list, err := self.client.Resource(servicesGVR).Namespace(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	states := make(map[string]*UnbindServiceState, len(list.Items))
	for i := range list.Items {
		state, err := unbindServiceState(&list.Items[i])
		if err != nil {
			return nil, err
		}
		states[list.Items[i].GetName()] = state
	}
	return states, nil
}

// A CR the operator has not reconciled yet has no status, its state is the zero status
func unbindServiceState(obj *unstructured.Unstructured) (*UnbindServiceState, error) {
	state := &UnbindServiceState{Generation: obj.GetGeneration()}

	statusMap, found, err := unstructured.NestedMap(obj.Object, "status")
	if err != nil {
		return nil, fmt.Errorf("failed to read service status: %w", err)
	}
	if !found {
		return state, nil
	}
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(statusMap, &state.Status); err != nil {
		return nil, fmt.Errorf("failed to convert service status: %w", err)
	}
	return state, nil
}
