# Build
FROM python:3.11-slim-buster AS build
WORKDIR /app

COPY requirements.txt .
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /app/wheels -r requirements.txt

# Runtime
FROM python:3.11-slim-buster AS runtime
WORKDIR /app

COPY --from=build /app/wheels /wheels
COPY harmonic-analyzer.py .

RUN pip install --no-cache /wheels/*

ENV MICRO_REGISTRY_URL=http://localhost:10000
ENV MICRO_SERVICE_URL=http://localhost:11000

EXPOSE 11000

CMD ["python3", "harmonic-analyzer.py"]

