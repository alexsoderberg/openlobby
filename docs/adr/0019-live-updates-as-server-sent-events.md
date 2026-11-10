# 0019. Live updates: server-sent events carry a group change signal
Status: Proposed (2026-11-10)
Requirement: REQ-0017 (F-035). Used by REQ-0018 (ADR 0020).
Amends: ADR 0002 (the gateway streams one route), ADR 0004 (successful lobby writes send a signal), ADR 0008 (one calendar instance, memory and connections), ADR 0009 (one edge location).

## Context
- REQ-0017: a change made by another member shows on the open screens within 5 seconds, only while the page is visible. A hidden tab catches up when it is shown again. A non-member gets nothing. A lost connection shows a notice and keeps the last data.
- The MVP has no real-time updates (REQ-0004, REQ-0012 amended for this). The dashboard loads with plain requests (ADR 0014).
- Limits in the code today: the gateway and calendar servers have a `WriteTimeout` of 30 seconds, which cuts off long responses. Edge uses Nginx's default `proxy_read_timeout` of 60 seconds and buffers responses. The gateway's proxy has a response header timeout of 30 seconds, for headers only.
- Every request writes an access log line to stdout, and the Pi runs on an SD card (ADR 0008).
- The database pool of each service has 5 connections (ADR 0008).

## Options measured
| Option | Latency | Load while idle | Log lines | Code and infrastructure |
|---|---|---|---|---|
| Polling every 3 s, full data | up to 3 s plus request time | one request per screen every 3 s | with 15 members, one tab each: 5 requests per second through gateway and calendar, about 10 lines per second, about 860,000 per day | none new |
| WebSocket | immediate | one connection per screen | few | protocol upgrade through gateway and edge (Upgrade headers in Nginx), bidirectional, which nothing needs |
| Server-sent events (SSE) | immediate | one open request per screen, no traffic | one line per connection; with 10-minute lifetimes and 15 members, about 4,000 per day | one route, streaming in gateway and calendar, one edge location |

Polling is the least code, but it costs about 10 log lines per second on an SD card, and it loads the Pi while nothing changes. SSE is a W3C standard, one-way and enough for the requirement. WebSocket adds a bidirectional protocol that nothing uses (YAGNI).

## Decision

**1. Transport: SSE.** `GET /api/live-updates` (operation `streamLiveUpdates`), session required. One stream per open browser tab, opened only while its page is visible.

**2. The stream carries a signal, not data.** The event is `groupChanged` and the data is the group's ID:

```
event: groupChanged
data: 3f1c0c2e-....

: keep-alive
```

After a signal the client loads its data with the existing endpoints. Reasons: the stream never holds lobby data, so nothing leaks after a membership change; authorization stays in the handlers that already exist; the client adds no new data format; the reload is the request the screen makes anyway.

**3. Who sends, and when.** `calendar` only. After a lobby write has committed, the lobby use case calls `ChangeNotifier.GroupChanged(ctx, groupID)`. The writes covered are: create, delete, join (also a seat change), leave, mode change, named activity change, and game change when it exists (ADR 0017 PR6). The call comes after the transaction has returned no error, so a denied or failed write sends nothing. Membership, invite and game list changes do not send (REQ-0017 out of scope).

The feed events (ADR 0020) are written in the same transaction as the lobby write, so they need no signal of their own.

**4. Membership is checked once per change, not per stream.** `ChangeNotifier` is an application use case, `LiveNotifier`:
1. It reads the current member IDs of the group with the existing `GroupReader.Members` (one query on `group_members` by `group_id`, a pooled connection held for a few milliseconds, after the commit).
2. It passes the group ID and the member IDs to the hub. The hub sends the signal to each open subscription whose user is in that set. A user who has left is not in the set, so nothing reaches them after the leave, and no separate unsubscribe is needed.
3. If the member query fails, the notifier closes all open streams and logs the error with the request ID. Clients reconnect and reload, so no signal is lost and no signal is sent to a non-member. This is the fail-closed choice.

The cost per change is one query plus at most one channel send per open stream of a member. With 15 members that is one query and at most 15 sends, however many tabs are open. Streams hold no database connection.

**5. Fan-out is in process.** `infrastructure/live` in `calendar` keeps the subscriptions, keyed by user ID. Each subscription has a buffer of `liveBufferSize` (16) signals. Sending never blocks. When a buffer is full, that stream is closed, and the client reconnects and reloads. A signal is never dropped silently.

**6. Stream protocol.**
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`.
- The handler subscribes before it writes the response headers, then flushes the headers. A change made after the subscription is therefore never missed. The client loads its data after the stream has opened, so no change falls into a gap.
- Heartbeat: a comment line every `liveHeartbeat` (25 seconds), below the 60-second edge timeout.
- Lifetime: `liveMaxLifetime` (10 minutes). Then the server ends the stream and the browser's EventSource reconnects. The session is checked at connect only. The stream carries no data, so a logout takes full effect on every data request at once, and an open stream after logout ends within 10 minutes.

**7. Client rules (ui-ux-expert, frontend module `live`).**
- Open the stream, then load the data.
- On every (re)connect, reload the visible data once.
- When the page is hidden (`visibilitychange`), close the stream. No connection is kept while hidden. When visible again: open the stream and reload.
- Signals arriving within `liveCoalesceWindow` (300 ms) lead to one reload.
- A stream error shows the paused notice until the stream opens again. EventSource retries network errors itself. An HTTP error (401, 503) closes it, and the client retries after `liveRetryDelay` (30 seconds) or at the next visibility change.
- The reload keeps the screen's state (point 8).

**8. Visible change and kept state (ui-ux-expert, `L-4`).**
- A row, block or card whose data differs from its last loaded version carries a visible marker (for example a highlighted border and a "Changed" text). The marker lasts `changeMarkerDuration`, a named constant that the UI expert sets (REQ-0017 ASSUMPTION). The first load marks nothing. A lobby that disappears or moves out of the week is removed without a marker.
- With reduced motion on, the marker appears and ends without animation, at the same times (REQ-0012).
- A reload never changes what the user is doing: open forms and their typed text, the scroll position, the chosen view (list, week or day) and the chosen day stay as they are. A reload updates the data inside the screen only.

**9. Gateway.** Route `GET /api/live-updates` to `calendar`, session required. For this route the gateway clears its server write deadline with `http.NewResponseController(w).SetWriteDeadline(time.Time{})` before it proxies, and passes the body through without buffering. `httputil.ReverseProxy` flushes `text/event-stream` responses at once. The backend checks this with a test on the pinned Go version. If it does not, the route sets `FlushInterval` to -1. The gateway keeps no state (ADR 0002). The access log line is written when the stream ends.

**10. Calendar.** The stream handler clears the write deadline in the same way, because the calendar server has a 30-second `WriteTimeout` too.

**11. Shutdown.**
- Calendar: on SIGTERM it closes all subscriptions before `server.Shutdown`. Otherwise shutdown would wait up to the 10-minute lifetime. Clients reconnect to the new container and reload. A test covers this.
- Gateway: on SIGTERM it cancels the base context of its server before `Shutdown`. The proxied requests then end, and so do their streams. Without this, `Shutdown` waits for the streams. The clients reconnect to the new container. The gateway code change is in L-2.

**12. Edge (DevOps).** A location for `/api/live-updates` with `proxy_buffering off;` and `proxy_http_version 1.1;`. It has no `limit_req`. The default 60-second `proxy_read_timeout` stays, because the heartbeat comes every 25 seconds. The smoke test covers it (L-3).

**13. One calendar instance.** The in-process hub is correct only while `calendar` runs as one instance. ADR 0008 has a single node, so that holds. With two instances a client on one of them misses signals from the other until its next reload, which the reconnect rule bounds.
- Compose keeps one replica. DevOps adds a comment in `infra/compose.yaml`.
- `calendar` writes an info line at startup: `live updates run in process: run one calendar instance`.
- Upgrade path, with no client change: PostgreSQL `LISTEN/NOTIFY`. `pg_notify` runs in the lobby transaction, so the notification commits with the change. A dedicated listener connection in calendar fans it out.
- Shortcut comment, required in code: `shortcut: live updates are in-process, one calendar instance only, upgrade to LISTEN/NOTIFY before running more instances`.

**14. Budget.**
- Memory: a stream holds a goroutine, a buffer and a socket, in the gateway and in calendar. Estimate 10 to 20 KB per stream in each of the two services, to be measured. The calendar cap is 64 MB with `GOMEMLIMIT` 48 MiB (ADR 0008). 15 tabs take about 0.3 MB in each service, far below the cap.
- Database: a stream holds no connection while idle. A change takes one pooled connection for one query (point 4). The 5-connection pool is not used up by streams.
- Edge: each tab uses two connections, one from the browser to edge and one from edge to gateway. Edge's `events {}` block has no explicit `worker_connections`, so Nginx's default of 512 per worker applies. 15 tabs use 30 of them.
- Connections from the gateway to calendar are one per stream and do not go through the pool of edge.
- Shortcut: `shortcut: no cap on open streams per user, add one if the Pi shows pressure`.

**15. Contract.** `api/calendar/openapi.yaml` gets the path `/api/live-updates` (GET), with a 200 response of `text/event-stream` that describes the format above, and a 401. If oapi-codegen cannot generate the handler for a streamed response, the handler is written by hand in `transport`. This is the approach of the cookie response in ADR 0012 (amendment review 5, item 2). The reviewer checks that the contract matches the handler.

## Consequences
- A signal reaches the client in milliseconds, and the reload takes about as long as any screen load on the Pi. The 5-second target has a wide margin. The DevOps smoke test checks it through edge with two clients (ASSUMPTION for the measurement).
- Each connection reloads once when it reconnects, so a visible page reloads about every 10 minutes. This costs one set of reads per page.
- Only signals reach the client. Nothing reveals a lobby to someone who is not a member of its group.
- There is no polling fallback. If an intermediary breaks streaming, the paused notice shows instead, and the smoke test catches this at deployment.
- The gateway and calendar change for streaming, so their tests cover the flush, the write deadline and the shutdown.

## Delivery in small PRs
Build starts after ADR 0017 is finished (its PR6 merged). L-1 and F-1 (ADR 0020) both change `application/lobbies.go`, so they are merged one after the other.

| PR | Scope | Owner | Needs |
|---|---|---|---|
| L-1 | Path in `api/calendar/openapi.yaml`. `ChangeNotifier` and `LiveNotifier` in application, the hub in `infrastructure/live`, the handler with headers, heartbeat, lifetime, write deadline, the signal after commit in lobby writes, the shutdown rule, the startup info line. Tests: a signal only after commit (a denied write sends nothing); a leaver gets nothing from the next change; a member query failure closes all streams; a full buffer closes that stream; lifetime with a fake clock; heartbeat; shutdown closes streams. | backend-expert | none |
| L-2 | Gateway route `GET /api/live-updates` (session), write deadline cleared, unbuffered flush (or `FlushInterval` -1), base context cancel on shutdown. Test with a fake upstream that sends a signal and checks that it arrives before the upstream ends, and that a shutdown ends the stream. | backend-expert | L-1 |
| L-3 | Edge location `/api/live-updates` with `proxy_buffering off` and `proxy_http_version 1.1`. Smoke test: two clients through edge; a change by one reaches the other in under 5 seconds. Comment in `infra/compose.yaml`: one replica of calendar. | devops-expert | L-2 |
| L-4 | Frontend module `live`: a provider with the source port and the EventSource adapter (as `ApiProvider`), visibility handling, the paused notice (text in the i18n catalog, wording by the UI expert), reload on signal and on connect, coalescing. Used by the group view and the dashboard (per group). The change marker and the kept state of point 8. Tests with a fake source and fake timers: hidden closes the stream; visible reloads; error shows the notice; no change means no re-render. Marker on a changed row only, not on the first load, ends after `changeMarkerDuration`; with reduced motion no animation and the same end time; a reload keeps typed text in an open form, the scroll position, the chosen view and the chosen day. | ui-ux-expert | L-1 |

## Not built now (YAGNI)
WebSocket, a message broker, LISTEN/NOTIFY (only the upgrade path), per-group streams, data in the stream, last-event-ID replay, a stream cap per user, a polling fallback, presence.

## Alternatives considered
- **Polling every 3 seconds.** The least code, but about 10 log lines per second on an SD card and constant load while nothing changes. Rejected.
- **WebSocket.** Bidirectional, not needed; an upgrade through gateway and edge. Rejected.
- **A message broker or queue.** A new external service for one instance. Rejected (CLAUDE.md, rules for asynchronous communication).
- **Data in the stream.** Lobby data would be sent outside the authorization of the handlers, and a removed member would need a stream change. Rejected.
- **One stream per group.** Joins and leaves would change the stream set. One stream per tab, with membership checked at each change, is simpler.
- **Membership checked per stream on each signal.** One query per open stream per change, so 15 tabs mean 15 queries per change on a 5-connection pool. Rejected for the one query per change of point 4.
- **LISTEN/NOTIFY now.** A listener connection with reconnect handling, with no benefit while there is one instance. Kept as the upgrade path.

## Open questions
- None for the user. The change marker duration is the UI expert's (REQ-0017 ASSUMPTION).
