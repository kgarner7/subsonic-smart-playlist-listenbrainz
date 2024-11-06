FROM oven/bun:latest AS builder

WORKDIR /ui
COPY ui/package.json ui/bun.lockb /ui
RUN bun install --frozen-lockfile

COPY ui /ui
RUN bun run build

FROM python:3.12-slim AS main
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-deps --no-cache-dir -r requirements.txt

COPY database_sync.py get_radio.py main.py .
COPY subsonic subsonic
COPY --from=builder /ui/dist/ ui/dist

RUN adduser noroot && chown -R noroot:noroot /app

USER noroot
EXPOSE 5000/tcp
ENTRYPOINT ["python3", "main.py"]