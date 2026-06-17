package utils

import (
	"testing"
)

func TestValidateCronExpression(t *testing.T) {
	tests := []struct {
		name    string
		cron    string
		wantErr bool
	}{
		{
			name:    "valid basic cron",
			cron:    "* * * * *",
			wantErr: false,
		},
		{
			name:    "valid specific time",
			cron:    "30 15 * * *",
			wantErr: false,
		},
		{
			name:    "valid with ranges",
			cron:    "0-30 9-17 * * *",
			wantErr: false,
		},
		{
			name:    "valid with lists",
			cron:    "0,15,30,45 * * * *",
			wantErr: false,
		},
		{
			name:    "valid with step values",
			cron:    "*/15 * * * *",
			wantErr: false,
		},
		{
			name:    "invalid field count",
			cron:    "* * * *",
			wantErr: true,
		},
		{
			name:    "invalid minute value",
			cron:    "60 * * * *",
			wantErr: true,
		},
		{
			name:    "invalid hour value",
			cron:    "* 24 * * *",
			wantErr: true,
		},
		{
			name:    "invalid day value",
			cron:    "* * 32 * *",
			wantErr: true,
		},
		{
			name:    "invalid month value",
			cron:    "* * * 13 *",
			wantErr: true,
		},
		{
			name:    "invalid weekday value",
			cron:    "* * * * 7",
			wantErr: true,
		},
		{
			name:    "invalid range",
			cron:    "5-3 * * * *",
			wantErr: true,
		},
		{
			name:    "invalid step value",
			cron:    "*/0 * * * *",
			wantErr: true,
		},
		{
			name:    "invalid characters",
			cron:    "a * * * *",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateCronExpression(tt.cron)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateCronExpression() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
