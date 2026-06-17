/*
Copyright 2025.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
package controller

import (
	"context"
	"time"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"
)

var _ = Describe("Service Controller", func() {
	Context("When reconciling a resource", func() {
		const resourceName = "test-resource"
		ctx := context.Background()
		typeNamespacedName := types.NamespacedName{
			Name:      resourceName,
			Namespace: "default",
		}

		BeforeEach(func() {
			By("creating the custom resource for the Kind Service")
			service := &v1.Service{}
			err := k8sClient.Get(ctx, typeNamespacedName, service)
			if err != nil && errors.IsNotFound(err) {
				resource := &v1.Service{
					ObjectMeta: metav1.ObjectMeta{
						Name:      resourceName,
						Namespace: "default",
					},
					Spec: v1.ServiceSpec{
						Name:             resourceName,
						Type:             "web",
						Builder:          "docker",
						TeamRef:          "test-team",
						ProjectRef:       "test-project",
						EnvironmentRef:   "test-env",
						KubernetesSecret: "test-secret",
						Config: v1.ServiceConfigSpec{
							Image:  "nginx:latest",
							Public: true,
							Hosts: []v1.HostSpec{
								{
									Host: "example.com",
									Path: "/",
								},
							},
							Ports: []v1.PortSpec{
								{
									Port: 80,
								},
							},
						},
					},
				}
				Expect(k8sClient.Create(ctx, resource)).To(Succeed())
			}
		})

		AfterEach(func() {
			// Clean up resources
			resource := &v1.Service{}
			err := k8sClient.Get(ctx, typeNamespacedName, resource)
			if err == nil {
				// Remove finalizers if they exist
				if len(resource.Finalizers) > 0 {
					resource.Finalizers = []string{}
					Expect(k8sClient.Update(ctx, resource)).To(Succeed())
				}

				// Then delete the resource
				Expect(k8sClient.Delete(ctx, resource)).To(Succeed())

				// Wait for it to be gone
				Eventually(func() bool {
					err := k8sClient.Get(ctx, typeNamespacedName, &v1.Service{})
					return errors.IsNotFound(err)
				}, time.Second*5, time.Millisecond*100).Should(BeTrue())
			}

			// Delete related resources
			deployment := &appsv1.Deployment{
				ObjectMeta: metav1.ObjectMeta{
					Name:      resourceName,
					Namespace: "default",
				},
			}
			_ = k8sClient.Delete(ctx, deployment)

			svc := &corev1.Service{
				ObjectMeta: metav1.ObjectMeta{
					Name:      resourceName,
					Namespace: "default",
				},
			}
			_ = k8sClient.Delete(ctx, svc)

			ingress := &networkingv1.Ingress{
				ObjectMeta: metav1.ObjectMeta{
					Name:      resourceName,
					Namespace: "default",
				},
			}
			_ = k8sClient.Delete(ctx, ingress)
		})

		It("should successfully reconcile the resource", func() {
			By("Reconciling the created resource")
			controllerReconciler := &ServiceReconciler{
				Client: k8sClient,
				Scheme: k8sClient.Scheme(),
			}
			_, err := controllerReconciler.Reconcile(ctx, reconcile.Request{
				NamespacedName: typeNamespacedName,
			})
			Expect(err).NotTo(HaveOccurred())

			// Verify the service has a finalizer
			var service v1.Service
			err = k8sClient.Get(ctx, typeNamespacedName, &service)
			Expect(err).NotTo(HaveOccurred())

			found := false
			for _, finalizer := range service.Finalizers {
				if finalizer == serviceFinalizer {
					found = true
					break
				}
			}
			Expect(found).To(BeTrue())
		})
	})
})
