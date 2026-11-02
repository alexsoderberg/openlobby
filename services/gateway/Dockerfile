# Build context is the repository root (ADR 0008). The module reads ../../pkg through a replace directive,
# so both directories are copied with their paths unchanged.
FROM golang:1.27.3 AS build
WORKDIR /src/services/gateway
COPY pkg /src/pkg
COPY services/gateway /src/services/gateway
ENV CGO_ENABLED=0
RUN go build -trimpath -ldflags="-s -w" -o /out/gateway ./cmd/gateway

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/gateway /gateway
ENTRYPOINT ["/gateway"]
CMD ["serve"]
