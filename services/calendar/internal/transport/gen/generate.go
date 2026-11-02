// Package gen holds the code generation directive for the calendar contract (ADR 0012).
package gen

//go:generate go tool oapi-codegen -config ../../../../../api/calendar/oapi-codegen-public.yaml -o publicapi/gen.go ../../../../../api/calendar/openapi.yaml
