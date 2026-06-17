package models

import (
	"reflect"

	"entgo.io/ent/dialect/sql"
	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/ent"
)

type SortOrder string

const (
	SortOrderAsc  SortOrder = "asc"
	SortOrderDesc SortOrder = "desc"
)

var SortOrderValues = []SortOrder{
	SortOrderAsc,
	SortOrderDesc,
}

func (u SortOrder) SortFunction() func(fields ...string) func(*sql.Selector) {
	switch u {
	case SortOrderAsc:
		return ent.Asc
	case SortOrderDesc:
		return ent.Desc
	}
	return ent.Desc
}

// Register enum in OpenAPI specification
// https://github.com/danielgtaylor/huma/issues/621
func (u SortOrder) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["SortOrder"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "SortOrder")
		schemaRef.Title = "SortOrder"
		for _, v := range SortOrderValues {
			schemaRef.Enum = append(schemaRef.Enum, string(v))
		}
		r.Map()["SortOrder"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/SortOrder"}
}

type SortByField string

const (
	SortByCreatedAt SortByField = "created_at"
	SortByUpdatedAt SortByField = "updated_at"
)

var SortByFieldValues = []SortByField{
	SortByCreatedAt,
	SortByUpdatedAt,
}

// Register enum in OpenAPI specification
// https://github.com/danielgtaylor/huma/issues/621
func (u SortByField) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["SortByField"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "SortByField")
		schemaRef.Title = "SortByField"
		for _, v := range SortByFieldValues {
			schemaRef.Enum = append(schemaRef.Enum, string(v))
		}
		r.Map()["SortByField"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/SortByField"}
}

type SortInput struct {
	SortByField SortByField `query:"sort_by" default:"created_at" required:"false"`
	SortOrder   SortOrder   `query:"sort_order" default:"desc" required:"false"`
}
