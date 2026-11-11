package transport

import (
	"os"
	"regexp"
	"strings"
	"testing"
)

// Public contracts and the upstream that serves them. api/auth/internal.yaml is internal and never routed (ADR 0002).
var publicContracts = map[string]upstreamName{
	"../../../../api/auth/openapi.yaml":     authUpstream,
	"../../../../api/calendar/openapi.yaml": calendarUpstream,
}

// The keys of the contracts that the scan reads, at the indentation the contracts use.
const contractPathsKey = "paths:"

var (
	contractPath      = regexp.MustCompile(`^  (/\S*):\s*$`)
	contractOperation = regexp.MustCompile(`^    (get|put|post|delete|patch):\s*$`)
	// An operation that overrides the top-level session security with none is public.
	contractPublic = regexp.MustCompile(`^      security:\s*\[\]\s*$`)
)

// contractOperations maps "METHOD path" of every operation in a contract to whether it is public.
// shortcut: a line scan instead of an OpenAPI parser (ADR 0012 approves kin-openapi for calendar only); switch if a contract uses $ref path items.
func contractOperations(t *testing.T, file string) map[string]bool {
	t.Helper()
	contract, err := os.ReadFile(file)
	if err != nil {
		t.Fatal(err)
	}
	ops := map[string]bool{}
	inPaths, path, op := false, "", ""
	// TrimSuffix handles a CRLF checkout on Windows.
	for _, line := range strings.Split(string(contract), "\n") {
		line = strings.TrimSuffix(line, "\r")
		if line != "" && line[0] != ' ' && line[0] != '#' {
			inPaths = line == contractPathsKey
			continue
		}
		if !inPaths {
			continue
		}
		if m := contractPath.FindStringSubmatch(line); m != nil {
			path = m[1]
		} else if m := contractOperation.FindStringSubmatch(line); m != nil {
			op = strings.ToUpper(m[1]) + " " + path
			ops[op] = false
		} else if contractPublic.MatchString(line) {
			ops[op] = true
		}
	}
	if len(ops) == 0 {
		t.Fatalf("%s: no operations found", file)
	}
	return ops
}

// TestRouteTableMatchesTheContracts fails when a contract operation is missing from the route table, or has the
// wrong upstream or session rule, and when the table routes an API path that no contract has.
func TestRouteTableMatchesTheContracts(t *testing.T) {
	table := map[string]route{}
	for _, rt := range routes {
		table[rt.method+" "+rt.path] = rt
	}
	inContract := map[string]bool{}
	for file, upstream := range publicContracts {
		for op, public := range contractOperations(t, file) {
			inContract[op] = true
			rt, ok := table[op]
			switch {
			case !ok:
				t.Errorf("%s: not in the route table", op)
			case rt.upstream != upstream:
				t.Errorf("%s: upstream %s, want %s", op, rt.upstream, upstream)
			case rt.session == public:
				t.Errorf("%s: session %v, contract public %v", op, rt.session, public)
			}
		}
	}
	for op, rt := range table {
		if rt.method != "" && !inContract[op] {
			t.Errorf("%s: in the route table but in no contract", op)
		}
	}
}
