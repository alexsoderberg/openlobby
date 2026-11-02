// Package gen holds the code generation directives for the auth contracts (ADR 0012).
package gen

//go:generate go tool oapi-codegen -config ../../../../../api/auth/oapi-codegen-public.yaml -o publicapi/gen.go ../../../../../api/auth/openapi.yaml
//go:generate go tool oapi-codegen -config ../../../../../api/auth/oapi-codegen-internal.yaml -o internalapi/gen.go ../../../../../api/auth/internal.yaml
