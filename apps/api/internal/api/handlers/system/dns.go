package system_handler

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
)

type DnsCheckInput struct {
	server.BaseAuthInput
	Domain string `query:"domain" required:"true" description:"Domain to check DNS for"`
}

type DnsCheck struct {
	IsCloudflare bool             `json:"is_cloudflare"`
	DnsStatus    models.DNSStatus `json:"dns_status"`
}

type DnsCheckResponse struct {
	Body struct {
		Data *DnsCheck `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) CheckDNSResolution(ctx context.Context, input *DnsCheckInput) (*DnsCheckResponse, error) {
	// Get k8s IPs for load balancer server
	ips, err := self.srv.KubeClient.GetIngressNginxIP(ctx)
	if err != nil {
		log.Error("Error getting ingress nginx IP", "err", err)
		return nil, huma.Error500InternalServerError("Error getting ingress nginx IP")
	}

	// Check DNS
	dnsCheck := &DnsCheck{
		DnsStatus: models.DNSStatusUnresolved,
	}
	resolved, err := self.srv.DNSChecker.IsPointingToIP(input.Domain, ips.IPv4)
	if err != nil {
		log.Error("Error checking DNS", "err", err)
		return nil, huma.Error500InternalServerError("Error checking DNS")
	}
	if resolved {
		dnsCheck.DnsStatus = models.DNSStatusResolved
	}

	if !resolved {
		resolved, err = self.srv.DNSChecker.IsPointingToIP(input.Domain, ips.IPv6)
		if err != nil {
			log.Error("Error checking DNS", "err", err)
			return nil, huma.Error500InternalServerError("Error checking DNS")
		}
		if resolved {
			dnsCheck.DnsStatus = models.DNSStatusResolved
		}
	}

	// Check Cloudflare
	if !resolved {
		resolved, err = self.srv.DNSChecker.IsUsingCloudflareProxy(input.Domain)
		if err != nil {
			log.Error("Error checking Cloudflare", "err", err)
		}
		dnsCheck.IsCloudflare = resolved
	}

	if dnsCheck.IsCloudflare {
		// Spin up an ingress to verify
		testIngress, testPath, err := self.srv.KubeClient.CreateVerificationIngress(ctx, input.Domain, self.srv.KubeClient.GetInternalClient())
		if err != nil {
			log.Warnf("Error creating ingress test for domain %s: %v", input.Domain, err)
		} else {
			defer func() {
				err := self.srv.KubeClient.DeleteVerificationIngress(ctx, testIngress.Name, self.srv.KubeClient.GetInternalClient())
				if err != nil {
					log.Warnf("Error deleting ingress test for domain %s: %v", input.Domain, err)
				}
			}()

			url := fmt.Sprintf("https://%s/.unbind-challenge/%s", input.Domain, testPath)

			// Create a new request with context
			req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
			if err != nil {
				log.Warnf("Error creating HTTP request for domain %s: %v", input.Domain, err)
			} else {
				// Retry delaying 200ms between tries
				maxRetries := 20
				for attempt := 0; attempt < maxRetries; attempt++ {
					if attempt > 0 {
						time.Sleep(200 * time.Millisecond)
					}

					// Execute the request
					resp, err := self.srv.HttpClient.Do(req)
					if err != nil {
						log.Warnf("Attempt %d: Error executing HTTP request for domain %s: %v", attempt+1, input.Domain, err)
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
