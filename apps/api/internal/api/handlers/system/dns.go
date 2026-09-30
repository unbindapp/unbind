package system_handler

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/models"
)

type DnsCheckInput struct {
	server.BaseAuthInput
	Domain string `query:"domain" required:"true" doc:"Domain to check DNS for. A wildcard like *.example.com is checked through a subdomain it covers"`
}

type DnsCheck struct {
	IsCloudflare                 bool             `json:"is_cloudflare"`
	CloudflareMissingCertificate bool             `json:"cloudflare_missing_certificate"`
	DnsStatus                    models.DNSStatus `json:"dns_status"`
}

type DnsCheckResponse struct {
	Body struct {
		Data *DnsCheck `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) CheckDNSResolution(ctx context.Context, input *DnsCheckInput) (*DnsCheckResponse, error) {
	if err := utils.ValidateServiceHost(input.Domain); err != nil {
		return nil, huma.Error400BadRequest(err.Error())
	}
	// A wildcard is checked through a subdomain it covers
	domain := utils.ProbeHost(input.Domain)

	// Get k8s IPs for load balancer server
	ips, err := self.srv.KubeClient.GetIngressNginxIP(ctx)
	if err != nil {
		return nil, oapi.MapError(errdefs.NewInternalError(err, "Failed to look up the ingress IP"))
	}

	// Check DNS
	dnsCheck := &DnsCheck{
		DnsStatus: models.DNSStatusUnresolved,
	}
	resolved, err := self.srv.DNSChecker.IsPointingToIP(domain, ips.IPv4)
	if err != nil {
		return nil, oapi.MapError(errdefs.NewInternalError(err, "Failed to check the domain's DNS records"))
	}
	if resolved {
		dnsCheck.DnsStatus = models.DNSStatusResolved
	}

	if !resolved {
		resolved, err = self.srv.DNSChecker.IsPointingToIP(domain, ips.IPv6)
		if err != nil {
			return nil, oapi.MapError(errdefs.NewInternalError(err, "Failed to check the domain's DNS records"))
		}
		if resolved {
			dnsCheck.DnsStatus = models.DNSStatusResolved
		}
	}

	// Check Cloudflare
	if !resolved {
		resolved, err = self.srv.DNSChecker.IsUsingCloudflareProxy(domain)
		if err != nil {
			log.Error("Error checking Cloudflare", "err", err)
		}
		dnsCheck.IsCloudflare = resolved
	}

	if dnsCheck.IsCloudflare {
		dnsCheck.CloudflareMissingCertificate = !self.srv.DNSChecker.ServesTLS(domain)
	}

	if dnsCheck.IsCloudflare && !dnsCheck.CloudflareMissingCertificate {
		// Spin up a verification route to confirm the domain reaches the cluster
		routeName, probeURL, err := self.srv.KubeClient.CreateVerificationRoute(ctx, domain, self.srv.KubeClient.GetInternalClient())
		if err != nil {
			log.Warnf("Error creating verification route for domain %s: %v", domain, err)
		} else {
			defer func() {
				err := self.srv.KubeClient.DeleteVerificationRoute(ctx, routeName, self.srv.KubeClient.GetInternalClient())
				if err != nil {
					log.Warnf("Error deleting verification route for domain %s: %v", domain, err)
				}
			}()

			req, err := http.NewRequestWithContext(ctx, "GET", probeURL, nil)
			if err != nil {
				log.Warnf("Error creating HTTP request for domain %s: %v", domain, err)
			} else {
				// Retry delaying 200ms between tries
				maxRetries := 20
				for attempt := range maxRetries {
					if attempt > 0 {
						time.Sleep(200 * time.Millisecond)
					}

					resp, err := self.srv.HttpClient.Do(req)
					if err != nil {
						log.Warnf("Attempt %d: Error executing HTTP request for domain %s: %v", attempt+1, domain, err)
						continue // Try again after sleep
					}

					func() {
						defer resp.Body.Close()
						// Check for the special header
						if resp.Header.Get("X-DNS-Check") == "resolved" {
							dnsCheck.DnsStatus = models.DNSStatusResolved
							return // Exit the closure
						}
					}()

					if dnsCheck.DnsStatus == models.DNSStatusResolved {
						break
					}
				}
			}
		}
	}

	resp := &DnsCheckResponse{}
	resp.Body.Data = dnsCheck
	return resp, nil
}
