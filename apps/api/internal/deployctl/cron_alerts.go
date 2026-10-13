package deployctl

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	webhooks_service "github.com/unbindapp/unbind-api/internal/services/webooks"
	batchv1 "k8s.io/api/batch/v1"
)

// SyncCronRunFailures sends one alert per failed run, then marks the run so it is not sent again
func (self *DeploymentController) SyncCronRunFailures(ctx context.Context) error {
	client := self.k8s.GetInternalClient()
	failed, err := self.k8s.ListUnalertedFailedCronRuns(ctx, client)
	if err != nil {
		return err
	}

	for _, job := range failed {
		if err := self.sendCronRunFailedWebhook(ctx, job); err != nil {
			log.Error("Failed to alert on a failed cron run", "err", err, "job", job.Name, "namespace", job.Namespace)
			continue
		}
		if err := self.k8s.MarkCronRunAlerted(ctx, job, client); err != nil {
			log.Error("Failed to mark a cron run as alerted", "err", err, "job", job.Name, "namespace", job.Namespace)
		}
	}
	return nil
}

func (self *DeploymentController) sendCronRunFailedWebhook(ctx context.Context, job *batchv1.Job) error {
	serviceID, err := uuid.Parse(job.Labels["unbind-service"])
	if err != nil {
		return fmt.Errorf("run %s has no service label: %w", job.Name, err)
	}
	service, err := self.repo.Service().GetByID(ctx, serviceID)
	if err != nil {
		return fmt.Errorf("loading service %s: %w", serviceID, err)
	}

	reason := "The run exited with an error"
	for _, condition := range job.Status.Conditions {
		if condition.Type == batchv1.JobFailed && condition.Message != "" {
			reason = condition.Message
		}
	}

	url, _ := utils.JoinURLPaths(self.cfg.ExternalUIUrl, service.Edges.Environment.Edges.Project.Edges.Team.ID.String(), "project", service.Edges.Environment.Edges.Project.ID.String(), "?environment="+service.EnvironmentID.String(), "&service="+service.ID.String())
	data := webhooks_service.WebhookData{
		Title: "Cron Run Failed",
		Url:   url,
		Fields: []webhooks_service.WebhookDataField{
			{Name: "Service", Value: service.Name},
			{Name: "Project & Environment", Value: fmt.Sprintf("%s > %s", service.Edges.Environment.Edges.Project.Name, service.Edges.Environment.Name)},
			{Name: "Run", Value: job.Name},
			{Name: "Error Message", Value: reason},
		},
	}
	return self.webhookService.TriggerWebhooks(ctx, webhooks_service.WebhookLevelDeploymentFailed, schema.WebhookEventCronFailed, data, service.Edges.Environment.Edges.Project.TeamID, service.Edges.Environment.Edges.Project.ID)
}
