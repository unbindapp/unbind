package variables_service

import (
	"context"
	"fmt"
	"regexp"

	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
)

var legacyServiceReferencePattern = regexp.MustCompile(`\$\{\{service\.([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\.([-._a-zA-Z0-9]+)\}\}`)

// rewriteLegacyServiceReferences turns ${{service.<id>.KEY}} into ${{service:<id>.KEY}}
func rewriteLegacyServiceReferences(value string) (string, bool) {
	if !legacyServiceReferencePattern.MatchString(value) {
		return value, false
	}
	return legacyServiceReferencePattern.ReplaceAllString(value, "$${{service:$1.$2}}"), true
}

func hasLegacyServiceReference(value []byte) bool {
	return legacyServiceReferencePattern.Match(value)
}

type variableSecret struct {
	name      string
	namespace string
}

// MigrateServiceReferenceSyntax rewrites every stored ${{service.<id>.KEY}} reference
// into ${{service:<id>.KEY}}. The old form no longer resolves, so any failure is
// returned and the migration runs again on the next start.
func (self *VariablesService) MigrateServiceReferenceSyntax(ctx context.Context) error {
	settings, err := self.repo.System().GetSystemSettings(ctx, nil)
	if err == nil && settings.ServiceReferenceSyntaxMigrated {
		return nil
	}
	if err != nil && !ent.IsNotFound(err) {
		return err
	}

	secrets, err := self.variableSecrets(ctx)
	if err != nil {
		return err
	}

	client := self.k8s.GetInternalClient()
	migrated := 0
	for _, secret := range secrets {
		values, err := self.k8s.GetSecretMap(ctx, secret.name, secret.namespace, client)
		if k8serrors.IsNotFound(err) {
			continue
		}
		if err != nil {
			return fmt.Errorf("read secret %s/%s: %w", secret.namespace, secret.name, err)
		}

		updates := make(map[string][]byte)
		for name, raw := range values {
			if rewritten, changed := rewriteLegacyServiceReferences(string(raw)); changed {
				updates[name] = []byte(rewritten)
			}
		}
		if len(updates) == 0 {
			continue
		}

		if _, err := self.k8s.UpsertSecretValues(ctx, secret.name, secret.namespace, updates, client); err != nil {
			return fmt.Errorf("rewrite secret %s/%s: %w", secret.namespace, secret.name, err)
		}
		migrated++
	}

	if migrated > 0 {
		log.Infof("Rewrote service references in %d variable secrets", migrated)
	}
	return self.repo.System().MarkServiceReferenceSyntaxMigrated(ctx)
}

// variableSecrets lists the secret of every team, project, environment and service
func (self *VariablesService) variableSecrets(ctx context.Context) ([]variableSecret, error) {
	teams, err := self.repo.Team().GetAll(ctx, nil)
	if err != nil {
		return nil, err
	}

	var secrets []variableSecret
	for _, team := range teams {
		secrets = append(secrets, variableSecret{name: team.KubernetesSecret, namespace: team.Namespace})

		projects, err := self.repo.Project().GetByTeam(ctx, team.ID, nil, nil, models.SortByCreatedAt, models.SortOrderAsc)
		if err != nil {
			return nil, fmt.Errorf("list projects of team %s: %w", team.ID, err)
		}
		for _, project := range projects {
			secrets = append(secrets, variableSecret{name: project.KubernetesSecret, namespace: team.Namespace})
			for _, environment := range project.Edges.Environments {
				secrets = append(secrets, variableSecret{name: environment.KubernetesSecret, namespace: team.Namespace})
			}
		}

		services, err := self.repo.Service().GetByScope(ctx, schema.VariableReferenceSourceTypeTeam, team.ID)
		if err != nil {
			return nil, fmt.Errorf("list services of team %s: %w", team.ID, err)
		}
		for _, service := range services {
			secrets = append(secrets, variableSecret{name: service.KubernetesSecret, namespace: team.Namespace})
		}
	}
	return secrets, nil
}
