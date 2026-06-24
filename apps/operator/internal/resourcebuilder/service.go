package resourcebuilder

import (
	"fmt"
	"strings"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
)

// Builder for kubernetes Service objects
var ErrServiceNotNeeded = fmt.Errorf("service not needed, probably no ports configured")

// BuildServices builds kubernetes Service objects, creating NodePort services where specified
func (rb *ResourceBuilder) BuildServices() ([]*corev1.Service, error) {
	if len(rb.service.Spec.Config.Ports) < 1 {
		return nil, ErrServiceNotNeeded
	}

	if rb.isDatabase() {
		return rb.buildDatabaseServices()
	}

	// Group ports by service type (NodePort vs ClusterIP). When the provider routes
	// L4 via the gateway, external ports stay ClusterIP and are fronted by TCP/UDP
	// routes instead of a NodePort Service.
	viaGateway := rb.provider.ExposesL4ViaGateway()
	nodePortPorts := []corev1.ServicePort{}
	clusterIPPorts := []corev1.ServicePort{}

	for _, port := range rb.service.Spec.Config.Ports {
		protocol := corev1.ProtocolTCP
		if port.Protocol != nil {
			protocol = *port.Protocol
		}

		servicePort := corev1.ServicePort{
			Name:       strings.ToLower(fmt.Sprintf("%s-%d-%s", rb.service.Spec.Name, port.Port, protocol)),
			Protocol:   protocol,
			Port:       port.Port,
			TargetPort: intstr.FromInt32(port.Port),
		}

		if port.NodePort != nil && !viaGateway {
			servicePort.NodePort = *port.NodePort
			nodePortPorts = append(nodePortPorts, servicePort)
		} else {
			clusterIPPorts = append(clusterIPPorts, servicePort)
		}
	}

	services := []*corev1.Service{}

	// Create NodePort service if needed
	if len(nodePortPorts) > 0 {
		nodePortService := &corev1.Service{
			ObjectMeta: rb.buildObjectMeta(),
			Spec: corev1.ServiceSpec{
				Type:     corev1.ServiceTypeNodePort,
				Selector: rb.getLabelSelectors(),
				Ports:    nodePortPorts,
			},
		}
		// Add a suffix to distinguish the NodePort service
		nodePortService.Name += "-nodeport"
		services = append(services, nodePortService)
	}

	// Create ClusterIP service if needed
	if len(clusterIPPorts) > 0 {
		meta := rb.buildObjectMeta()
		if annotations := rb.provider.ServiceAnnotations(rb.service); len(annotations) > 0 {
			meta.Annotations = annotations
		}
		clusterIPService := &corev1.Service{
			ObjectMeta: meta,
			Spec: corev1.ServiceSpec{
				Selector: rb.getLabelSelectors(),
				Ports:    clusterIPPorts,
			},
		}
		services = append(services, clusterIPService)
	}

	return services, nil
}

// buildDatabaseServices builds the external L4 bridge for a public database,
// selecting the engine-managed pods. Returns ErrServiceNotNeeded when the database
// is private (no NodePort-flagged port).
func (rb *ResourceBuilder) buildDatabaseServices() ([]*corev1.Service, error) {
	viaGateway := rb.provider.ExposesL4ViaGateway()

	var ports []corev1.ServicePort
	for _, port := range rb.service.Spec.Config.Ports {
		if port.NodePort == nil {
			continue
		}
		protocol := corev1.ProtocolTCP
		if port.Protocol != nil {
			protocol = *port.Protocol
		}
		servicePort := corev1.ServicePort{
			Name:       strings.ToLower(fmt.Sprintf("%s-%d-%s", rb.service.Spec.Name, port.Port, protocol)),
			Protocol:   protocol,
			Port:       port.Port,
			TargetPort: intstr.FromInt32(port.Port),
		}
		if !viaGateway {
			servicePort.NodePort = *port.NodePort
		}
		ports = append(ports, servicePort)
	}

	if len(ports) < 1 {
		return nil, ErrServiceNotNeeded
	}

	meta := rb.buildObjectMeta()
	meta.Name = rb.databaseExposureName()
	svc := &corev1.Service{
		ObjectMeta: meta,
		Spec: corev1.ServiceSpec{
			Selector: rb.databaseSelector(),
			Ports:    ports,
		},
	}
	if !viaGateway {
		svc.Spec.Type = corev1.ServiceTypeNodePort
	}

	return []*corev1.Service{svc}, nil
}
