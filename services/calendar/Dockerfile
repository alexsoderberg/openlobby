# Build context is the repository root (ADR 0008). The module reads ../../pkg through a replace directive,
# so both directories are copied with their paths unchanged.
FROM golang:1.27.3 AS build
WORKDIR /src/services/calendar
COPY pkg /src/pkg
COPY services/calendar /src/services/calendar
ENV CGO_ENABLED=0
RUN go build -trimpath -ldflags="-s -w" -o /out/calendar ./cmd/calendar

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/calendar /calendar
ENTRYPOINT ["/calendar"]
CMD ["serve"]
