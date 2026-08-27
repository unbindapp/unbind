package k8s

import (
	"bytes"
	"context"
	"fmt"
	"io"

	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	utilyaml "k8s.io/apimachinery/pkg/util/yaml"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/discovery/cached/memory"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/restmapper"
)

const applyFieldManager = "unbind-updater"

type resettableRESTMapper interface {
	meta.RESTMapper
	Reset()
}

type Applier struct {
	client           dynamic.Interface
	mapper           resettableRESTMapper
	defaultNamespace string
}

func NewApplier(client dynamic.Interface, disc discovery.DiscoveryInterface, defaultNamespace string) *Applier {
	mapper := restmapper.NewDeferredDiscoveryRESTMapper(memory.NewMemCacheClient(disc))
	return &Applier{
		client:           client,
		mapper:           mapper,
		defaultNamespace: defaultNamespace,
	}
}

func (self *Applier) Apply(ctx context.Context, manifests []byte) error {
	docs, err := decodeManifests(manifests)
	if err != nil {
		return err
	}

	if err := self.applyDocs(ctx, docs, true); err != nil {
		return err
	}
	return self.applyDocs(ctx, docs, false)
}

func (self *Applier) applyDocs(ctx context.Context, docs []*unstructured.Unstructured, dryRun bool) error {
	for _, obj := range docs {
		if err := self.applyOne(ctx, obj, dryRun); err != nil {
			return fmt.Errorf("failed to apply %s %s: %w", obj.GetKind(), obj.GetName(), err)
		}
	}
	return nil
}

func (self *Applier) applyOne(ctx context.Context, obj *unstructured.Unstructured, dryRun bool) error {
	mapping, err := self.mapping(obj)
	// A bundle can ship a CRD and its CR together; the CR resolves on the real pass.
	if dryRun && meta.IsNoMatchError(err) {
		return nil
	}
	if err != nil {
		return err
	}

	resource := self.client.Resource(mapping.Resource)
	var iface dynamic.ResourceInterface = resource
	if mapping.Scope.Name() == meta.RESTScopeNameNamespace {
		namespace := obj.GetNamespace()
		if namespace == "" {
			namespace = self.defaultNamespace
		}
		iface = resource.Namespace(namespace)
	}

	opts := metav1.ApplyOptions{FieldManager: applyFieldManager, Force: true}
	if dryRun {
		opts.DryRun = []string{metav1.DryRunAll}
	}
	_, err = iface.Apply(ctx, obj.GetName(), obj, opts)
	return err
}

func (self *Applier) mapping(obj *unstructured.Unstructured) (*meta.RESTMapping, error) {
	gvk := obj.GroupVersionKind()
	mapping, err := self.mapper.RESTMapping(gvk.GroupKind(), gvk.Version)
	if err == nil || !meta.IsNoMatchError(err) {
		return mapping, err
	}
	self.mapper.Reset()
	return self.mapper.RESTMapping(gvk.GroupKind(), gvk.Version)
}

func decodeManifests(manifests []byte) ([]*unstructured.Unstructured, error) {
	decoder := utilyaml.NewYAMLOrJSONDecoder(bytes.NewReader(manifests), 4096)
	docs := make([]*unstructured.Unstructured, 0)
	for {
		obj := &unstructured.Unstructured{}
		err := decoder.Decode(obj)
		if err == io.EOF {
			return docs, nil
		}
		if err != nil {
			return nil, fmt.Errorf("failed to decode manifest: %w", err)
		}
		if len(obj.Object) == 0 {
			continue
		}
		if obj.GetKind() == "" || obj.GetName() == "" {
			return nil, fmt.Errorf("manifest is missing kind or name: %v", obj.Object)
		}
		docs = append(docs, obj)
	}
}
