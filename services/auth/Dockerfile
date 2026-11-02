# Build context is the repository root (ADR 0008). The module reads ../../pkg through a replace directive,
# so both directories are copied with their paths unchanged.
FROM golang:1.27.3 AS build
WORKDIR /src/services/auth
COPY pkg /src/pkg
COPY services/auth /src/services/auth
ENV CGO_ENABLED=0
RUN go build -trimpath -ldflags="-s -w" -o /out/auth ./cmd/auth

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/auth /auth
ENTRYPOINT ["/auth"]
CMD ["serve"]
