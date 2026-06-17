package k3s

import (
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/tools/clientcmd"
)

func NewK8sClient(kubeConfigFile string) (*dynamic.DynamicClient, error) {
	kubeConfig, err := clientcmd.BuildConfigFromFlags("", kubeConfigFile)
	if err != nil {
		return nil, err
	}

	client, err := dynamic.NewForConfig(kubeConfig)
	if err != nil {
		return nil, err
	}
	return client, nil
}
