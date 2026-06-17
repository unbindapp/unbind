# Unbind charts

Meta [helmfile](https://github.com/roboll/helmfile/tree/master) to manage unbind and all of its dependencies.

The first-party charts under `charts/` are also published as OCI artifacts to `oci://ghcr.io/unbindapp/charts` on changes (see `.github/workflows/publish-charts.yml`). The installer consumes this directory directly via a sparse checkout of the monorepo.

## Namespace

By default, and by the [unbind-installer](https://github.com/unbindapp/unbind-installer) all resources are tied to the same namespace.

This gives the unbind service account access to all of its resources (as it has superuser permissions to its own namespace)

## Bringing your own cluster

**Wild card domain**

Unbind expects and requires to take over a domain, this means a wildcard DNS record like `A * 50.51.52.53 mydomain.com`

`mydomain.com` is the value you must set for `global.baseDomain`

You can take over a subdomain as well, `*.sub.mydomain.com`, then your base domain becomes `sub.mydomain.com`

If you bring your own cluster, you may disable certain services. That's fine, but any services that you reference externally may not be configurable from Unbind UI anymore (you will have to manage them yourself, for example changing retention policy on metrics)

## Special cases (for bringing your own cluster)

### kube-state-metrics

If you have a pre-existing monitoring stack, Unbind metrics **will not work** _unless_ you configure pod label exporting.

This can be done in the [kube-prometheus-stack](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack) chart by setting the following:

```
kube-state-metrics:
  extraArgs:
  - --metric-labels-allowlist=pods=[*]
```

### registry

At this time, unbind does not support external registries (for local builds) - but it will in the near future.

For now, unbind uses a private internal docker registry for builds from source code.

By default, your kubernetes distribution will not be able to pull from this registry.

An example of configuring this for k3s would be:

/etc/rancher/k3s/registries.yaml

```yaml
mirrors:
  docker-registry.unbind-system:5000:
    endpoint:
      - 'http://{any node IP for nodeport service}:31571'
configs:
  'docker-registry.unbind-system:5000':
    tls:
      insecure_skip_verify: true
```

**NodePort**

A node port service is required for the internal registry, so that the node host can resolve it.

It'd recommended to block incoming access to this port via a firewall.

Example with ufw:

```bash
sudo ufw default allow outgoing
sudo ufw default allow incoming
sudo ufw deny 31571/tcp
sudo ufw deny 31571/udp
sudo ufw allow from 192.168.1.0/24 to any port 31571
```

If running a multi-node cluster, and you have a private network, you'll want to allow access from all of the nodes, it may be like:

```bash
sudo ufw allow from10.0.0.0/24 to any port 31571
```

### buildkitd

Buildkitd will only schedule once per node, so you should not set replicas > the number of nodes in your cluster or else you'll have scheduling errors.

More replicas = higher build concurrency.

### alloy

[Alloy](https://grafana.com/docs/alloy/latest/) is required to export pod logs for unbind.

If you bring your own, you need to configure it to index unbind specific labels. IE:

```yaml
alloy:
  mounts:
    varlog: true
  configMap:
    content: |
      logging {
        level  = "info"
        format = "logfmt"
      }
      discovery.kubernetes "pods" {
        role = "pod"
        selectors {
          role = "pod"
          label = "unbind-team,unbind-project,unbind-environment,unbind-service"
        }
      }
      discovery.kubernetes "deployment_pods" {
        role = "pod"
        selectors {
          role = "pod"
          label = "unbind-deployment"
        }
      }
      discovery.relabel "pods" {
        targets = discovery.kubernetes.pods.targets
        rule {
          action        = "replace"
          source_labels = ["__meta_kubernetes_pod_label_unbind_team"]
          target_label  = "unbind_team"
        }
        rule {
          action        = "replace"
          source_labels = ["__meta_kubernetes_pod_label_unbind_project"]
          target_label  = "unbind_project"
        }
        rule {
          action        = "replace"
          source_labels = ["__meta_kubernetes_pod_label_unbind_environment"]
          target_label  = "unbind_environment"
        }
        rule {
          action        = "replace"
          source_labels = ["__meta_kubernetes_pod_label_unbind_service"]
          target_label  = "unbind_service"
        }
      }
      discovery.relabel "deployment_pods" {
        targets = discovery.kubernetes.deployment_pods.targets
        rule {
          action        = "replace"
          source_labels = ["__meta_kubernetes_pod_label_unbind_deployment"]
          target_label  = "unbind_deployment"
        }
      }
      loki.source.kubernetes "pods" {
        targets = discovery.relabel.pods.output
        forward_to = [loki.write.endpoint.receiver]
      }
      loki.source.kubernetes "deployment_pods" {
        targets = discovery.relabel.deployment_pods.output
        forward_to = [loki.write.endpoint.receiver]
      }
      loki.write "endpoint" {
        endpoint {
          url = "http://{{ .Environment.Values | get "overrides.alloy.loki.endpoint.host" }}.{{ .Environment.Values | get "overrides.alloy.loki.namespace" .Environment.Values.global.namespace }}.svc.cluster.local:{{ .Environment.Values | get "overrides.alloy.loki.endpoint.port" "80" }}/loki/api/v1/push"
          tenant_id = "local"
        }
      }
```

### Loki

[Loki](https://grafana.com/docs/loki/latest/) is used for querying unbind logs, if you bring your own you should update the alloy configuration to point to the host/namespace/port where it is deployed.
