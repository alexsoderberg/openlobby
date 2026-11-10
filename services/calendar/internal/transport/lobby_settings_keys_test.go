package transport

import (
	"maps"
	"strings"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"
)

// requiredBodyKeys copies the required keys of the request schemas, so this test fails when the contract drifts.
func TestRequiredBodyKeysMatchTheContract(t *testing.T) {
	spec, err := openapi3.NewLoader().LoadFromFile("../../../../api/calendar/openapi.yaml")
	if err != nil {
		t.Fatal(err)
	}
	for pattern, keys := range requiredBodyKeys {
		method, path, _ := strings.Cut(pattern, " ")
		item := spec.Paths.Find(path)
		if item == nil || item.GetOperation(method) == nil {
			t.Fatalf("%s: no such operation in the contract", pattern)
		}
		schema := item.GetOperation(method).RequestBody.Value.Content.Get("application/json").Schema.Value
		want := map[string]bool{}
		for _, key := range schema.Required {
			want[key] = schema.Properties[key].Value.Nullable
		}
		if !maps.Equal(keys, want) {
			t.Fatalf("%s: keys %v, contract %v", pattern, keys, want)
		}
	}
}
