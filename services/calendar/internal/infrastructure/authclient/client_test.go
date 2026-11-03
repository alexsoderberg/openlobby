package authclient_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"slices"
	"sync/atomic"
	"testing"
	"time"

	"openlobby/pkg/requestid"
	"openlobby/services/calendar/internal/domain"
	"openlobby/services/calendar/internal/infrastructure/authclient"
)

const (
	aliceID = "11111111-1111-4111-8111-111111111111"
	bobID   = "22222222-2222-4222-8222-222222222222"
	// maxIDsPerCall is the limit of api/auth/internal.yaml (lookupUsers, maxItems 100).
	maxIDsPerCall = 100
	testRequestID = "req-123"
	shortTimeout  = 50 * time.Millisecond
	// firstBatchDelay is how long auth takes to answer the first batch in the shared-deadline test.
	firstBatchDelay = 3 * time.Second
	// sharedDeadlineLimit is the most the whole lookup may take: the 5 s deadline (ADR 0004) plus slack.
	sharedDeadlineLimit = 5500 * time.Millisecond
)

// lookupRequest is the body that calendar sends, as api/auth/internal.yaml describes it.
type lookupRequest struct {
	UserIDs []string `json:"userIds"`
}

// answerNames is auth's happy path. It records every batch it receives and answers the names it knows.
// Like auth, it refuses more than 100 IDs.
func answerNames(t *testing.T, names map[string]string, batches *[][]string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var sent lookupRequest
		if err := json.NewDecoder(r.Body).Decode(&sent); err != nil {
			http.Error(w, "bad body", http.StatusBadRequest)
			return
		}
		if len(sent.UserIDs) > maxIDsPerCall {
			http.Error(w, "too many IDs", http.StatusBadRequest)
			return
		}
		*batches = append(*batches, sent.UserIDs)
		users := []map[string]string{}
		for _, id := range sent.UserIDs {
			if name, ok := names[id]; ok {
				users = append(users, map[string]string{"userId": id, "displayName": name})
			}
		}
		writeJSON(t, w, http.StatusOK, map[string]any{"users": users})
	}
}

// slowSecondBatch answers the first batch after firstBatchDelay and never answers a later one.
func slowSecondBatch(t *testing.T, calls *atomic.Int32) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var sent lookupRequest
		if err := json.NewDecoder(r.Body).Decode(&sent); err != nil {
			return
		}
		if calls.Add(1) > 1 {
			<-r.Context().Done()
			return
		}
		select {
		case <-time.After(firstBatchDelay):
		case <-r.Context().Done():
			return
		}
		users := make([]map[string]string, 0, len(sent.UserIDs))
		for _, id := range sent.UserIDs {
			users = append(users, map[string]string{"userId": id, "displayName": "Member"})
		}
		writeJSON(t, w, http.StatusOK, map[string]any{"users": users})
	}
}

func writeJSON(t *testing.T, w http.ResponseWriter, status int, body any) {
	t.Helper()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		t.Errorf("write stub body: %v", err)
	}
}

// fixedBody returns a handler that answers the given status and raw body.
func fixedBody(t *testing.T, status int, body string) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		if _, err := io.WriteString(w, body); err != nil {
			t.Errorf("write stub body: %v", err)
		}
	}
}

func newDirectory(t *testing.T, baseURL string) *authclient.Directory {
	t.Helper()
	directory, err := authclient.New(baseURL)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	return directory
}

// idsFor returns n distinct valid user IDs.
func idsFor(n int) []string {
	ids := make([]string, n)
	for i := range ids {
		ids[i] = fmt.Sprintf("%08x-0000-4000-8000-%012x", i+1, i+1)
	}
	return ids
}

// TestDisplayNamesSplitsLargeListsIntoBatchesOf100 checks the limit of 100 (ADR 0003): 100 IDs is one call, 101 is two.
func TestDisplayNamesSplitsLargeListsIntoBatchesOf100(t *testing.T) {
	tests := []struct {
		name        string
		count       int
		wantBatches []int
	}{
		{name: "no user needs no call", count: 0, wantBatches: nil},
		{name: "100 users in one call", count: 100, wantBatches: []int{100}},
		{name: "101 users in two calls", count: 101, wantBatches: []int{100, 1}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			checkBatches(t, tc.count, tc.wantBatches)
		})
	}
}

// checkBatches looks up count users and checks the names and the batch sizes that auth receives.
func checkBatches(t *testing.T, count int, wantBatches []int) {
	t.Helper()
	ids := idsFor(count)
	names := make(map[string]string, count)
	for _, id := range ids {
		names[id] = "Member " + id
	}
	var batches [][]string
	stub := httptest.NewServer(answerNames(t, names, &batches))
	defer stub.Close()

	got, err := newDirectory(t, stub.URL).DisplayNames(context.Background(), ids)

	if err != nil {
		t.Fatal(err)
	}
	assertNames(t, got, names)
	if sizes := batchSizes(batches); !slices.Equal(sizes, wantBatches) {
		t.Fatalf("batch sizes %v, want %v", sizes, wantBatches)
	}
}

// assertNames checks that got holds exactly the names of want.
func assertNames(t *testing.T, got, want map[string]string) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("got %d names, want %d", len(got), len(want))
	}
	for id, name := range want {
		if got[id] != name {
			t.Fatalf("name of %s is %q, want %q", id, got[id], name)
		}
	}
}

func batchSizes(batches [][]string) []int {
	var sizes []int
	for _, batch := range batches {
		sizes = append(sizes, len(batch))
	}
	return sizes
}

// The lookup has one deadline for all batches. The first batch is answered after 3 s and the second never is. One
// shared deadline ends the lookup at about 5 s; a deadline per batch would take about 8 s (ADR 0004, amendment 2026-11-02).
func TestDisplayNamesSharesOneDeadlineAcrossBatches(t *testing.T) {
	var calls atomic.Int32
	stub := httptest.NewServer(slowSecondBatch(t, &calls))
	defer stub.Close()

	start := time.Now()
	got, err := newDirectory(t, stub.URL).DisplayNames(context.Background(), idsFor(maxIDsPerCall+1))
	elapsed := time.Since(start)

	if got != nil {
		t.Fatalf("names %v returned with an error", got)
	}
	if !errors.Is(err, domain.ErrUnavailable) {
		t.Fatalf("err = %v, want ErrUnavailable", err)
	}
	if elapsed > sharedDeadlineLimit {
		t.Fatalf("lookup took %v, want at most %v for all batches", elapsed, sharedDeadlineLimit)
	}
}

func TestDisplayNamesSendsRequestIDToAuth(t *testing.T) {
	var gotRequestID string
	stub := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotRequestID = r.Header.Get(requestid.Header)
		writeJSON(t, w, http.StatusOK, map[string]any{"users": []any{
			map[string]string{"userId": aliceID, "displayName": "Alex"},
		}})
	}))
	defer stub.Close()
	request := httptest.NewRequest(http.MethodGet, "/", nil)
	request.Header.Set(requestid.Header, testRequestID)
	directory := newDirectory(t, stub.URL)

	requestid.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, err := directory.DisplayNames(r.Context(), []string{aliceID}); err != nil {
			t.Errorf("DisplayNames: %v", err)
		}
	})).ServeHTTP(httptest.NewRecorder(), request)

	if gotRequestID != testRequestID {
		t.Fatalf("X-Request-Id sent to auth = %q, want %q", gotRequestID, testRequestID)
	}
}

// authAnswers are the answers of auth that the adapter must map. A plain error is never unavailable.
type authAnswer struct {
	name            string
	handler         http.HandlerFunc
	wantUnavailable bool
}

func authAnswers(t *testing.T) []authAnswer {
	return []authAnswer{{
		name:            "auth does not answer (503)",
		handler:         fixedBody(t, http.StatusServiceUnavailable, `{"error":{"code":"service_unavailable","requestId":"r"}}`),
		wantUnavailable: true,
	},
		{
			name:    "auth rejects the request (400)",
			handler: fixedBody(t, http.StatusBadRequest, `{"error":{"code":"invalid_request","requestId":"r"}}`),
		},
		{
			name:    "auth internal error (500)",
			handler: fixedBody(t, http.StatusInternalServerError, `{"error":{"code":"internal_error","requestId":"r"}}`),
		},
		{
			name:    "malformed body",
			handler: fixedBody(t, http.StatusOK, `{"users": not json`),
		},
		{
			name:    "requested ID missing from the answer",
			handler: fixedBody(t, http.StatusOK, `{"users":[{"userId":"`+aliceID+`","displayName":"Alex"}]}`),
		},
		{
			name:    "empty display name is never returned",
			handler: fixedBody(t, http.StatusOK, `{"users":[{"userId":"`+aliceID+`","displayName":""},{"userId":"`+bobID+`","displayName":"Bo"}]}`),
		},
	}
}

func TestDisplayNamesMapsAuthAnswers(t *testing.T) {
	for _, answer := range authAnswers(t) {
		t.Run(answer.name, func(t *testing.T) {
			stub := httptest.NewServer(answer.handler)
			defer stub.Close()

			got, err := newDirectory(t, stub.URL).DisplayNames(context.Background(), []string{aliceID, bobID})

			if got != nil {
				t.Fatalf("names %v returned with an error", got)
			}
			if errors.Is(err, domain.ErrUnavailable) != answer.wantUnavailable {
				t.Fatalf("unavailable = %v, want %v (err %v)", errors.Is(err, domain.ErrUnavailable), answer.wantUnavailable, err)
			}
			if err == nil {
				t.Fatal("no error for a bad answer of auth")
			}
		})
	}
}

// A base URL that cannot form a request is a bug of the caller: a plain error (500), not "unavailable" (503).
func TestDisplayNamesMalformedBaseURLIsNotUnavailable(t *testing.T) {
	_, err := newDirectory(t, "http://[::1").DisplayNames(context.Background(), []string{aliceID})

	if err == nil || errors.Is(err, domain.ErrUnavailable) {
		t.Fatalf("err = %v, want a plain error", err)
	}
}

func TestDisplayNamesIsUnavailableWhenAuthIsDown(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	address := listener.Addr().String()
	if err := listener.Close(); err != nil {
		t.Fatalf("close listener: %v", err)
	}

	_, err = newDirectory(t, "http://"+address).DisplayNames(context.Background(), []string{aliceID})

	if !errors.Is(err, domain.ErrUnavailable) {
		t.Fatalf("err = %v, want ErrUnavailable", err)
	}
}

// The caller's deadline bounds the lookup, so an auth that does not answer in time is unavailable.
func TestDisplayNamesIsUnavailableWhenAuthIsSlow(t *testing.T) {
	stub := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		// The body is read first: the server notices a closed connection only after that.
		if _, err := io.Copy(io.Discard, r.Body); err != nil {
			return
		}
		<-r.Context().Done()
	}))
	defer stub.Close()
	ctx, cancel := context.WithTimeout(context.Background(), shortTimeout)
	defer cancel()

	_, err := newDirectory(t, stub.URL).DisplayNames(ctx, []string{aliceID})

	if !errors.Is(err, domain.ErrUnavailable) {
		t.Fatalf("err = %v, want ErrUnavailable", err)
	}
}
