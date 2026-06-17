package models

import "time"

type PaginationParams struct {
	Cursor  time.Time `query:"cursor" required:"false"`
	PerPage int       `query:"per_page" required:"true" default:"50" minimum:"1" maximum:"100"`
}

type PaginationResponseMetadata struct {
	HasNext        bool       `json:"has_next"`
	PreviousCursor *time.Time `json:"previous,omitempty"`
	NextCursor     *time.Time `json:"next,omitempty"`
}
