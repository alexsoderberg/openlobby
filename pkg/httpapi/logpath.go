package httpapi

import (
	"net/http"
	"path"
	"strings"
)

// tokenPlaceholder replaces an invite token in a logged path (ADR 0002 review 4).
const tokenPlaceholder = ":token"

// invitePaths are the path segments before an invite token (ADR 0007, ADR 0002 review 4).
var invitePaths = [][]string{{"api", "invites"}, {"invite"}}

// LogPath returns the request path for logs: no query string, and the invite token replaced by ":token".
// It works on the decoded path, cleaned as ServeMux cleans it, so encoded, doubled or dotted segments cannot hide
// a token. Only the exact suffix "join" is kept after a token, so a token split by an encoded slash is fully masked.
func LogPath(r *http.Request) string {
	cleaned := path.Clean("/" + r.URL.Path)
	segments := strings.Split(cleaned, "/")[1:]
	for _, prefix := range invitePaths {
		if hasSegmentPrefix(segments, prefix) {
			return maskedInvitePath(prefix, segments[len(prefix)+1:])
		}
	}
	return cleaned
}

// hasSegmentPrefix reports whether segments start with prefix and have a token segment after it. The comparison
// ignores case, so a path that is only spelled differently is masked as well.
func hasSegmentPrefix(segments, prefix []string) bool {
	if len(segments) <= len(prefix) {
		return false
	}
	for i, want := range prefix {
		if !strings.EqualFold(segments[i], want) {
			return false
		}
	}
	return true
}

// maskedInvitePath writes the prefix in its canonical form, the placeholder for the token, and the tail when it is "join".
func maskedInvitePath(prefix, tail []string) string {
	masked := "/" + strings.Join(prefix, "/") + "/" + tokenPlaceholder
	if len(tail) == 1 && strings.EqualFold(tail[0], "join") {
		masked += "/join"
	}
	return masked
}
