package system_repo

import (
	"context"
	"strings"

	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

func (self *SystemRepository) GetSystemSettings(ctx context.Context, tx repository.TxInterface) (*ent.SystemSetting, error) {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}

	return db.SystemSetting.Query().
		First(ctx)
}

type SystemSettingUpdateInput struct {
	WildcardDomain   *string                  `json:"wildcard_domain" doc:"Wildcard domain for the system"`
	BuildkitSettings *schema.BuildkitSettings `json:"buildkit_settings" doc:"Buildkit settings"`
}

func (self *SystemRepository) UpdateSystemSettings(ctx context.Context, input *SystemSettingUpdateInput) (settings *ent.SystemSetting, err error) {
	if err := self.base.WithTx(ctx, func(tx repository.TxInterface) error {
		// Get system settings
		settings, err = self.GetSystemSettings(ctx, tx)
		if err != nil && !ent.IsNotFound(err) {
			return err
		}
		if ent.IsNotFound(err) {
			// Create system settings
			settings, err = tx.Client().SystemSetting.Create().Save(ctx)
			if err != nil {
				return err
			}
		}

		// Update system settings
		m := tx.Client().SystemSetting.UpdateOneID(settings.ID)

		if input.WildcardDomain != nil {
			if *input.WildcardDomain == "" {
				m.ClearWildcardBaseURL()
			} else {
				d := strings.TrimPrefix(*input.WildcardDomain, "https://")
				d = strings.TrimPrefix(d, "http://")
				m.SetWildcardBaseURL(d)
			}
		}

		if input.BuildkitSettings != nil {
			m.SetBuildkitSettings(input.BuildkitSettings)
		}

		// Save system settings
		settings, err = m.Save(ctx)

		if err != nil {
			return err
		}
		return nil
	}); err != nil {
		return nil, err
	}

	return settings, nil
}
