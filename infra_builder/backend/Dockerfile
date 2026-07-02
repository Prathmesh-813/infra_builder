# InfraStudio backend — FastAPI pricing / AI / stripe / settings API.
# The app is the `backend` package (imports use `backend.routes...`), so it is
# placed at /app/backend with /app on PYTHONPATH and started as backend.main:app.
FROM python:3.12-slim

WORKDIR /app
ENV PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Dependencies first for layer caching.
COPY requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Application code.
COPY . /app/backend/

EXPOSE 8001

# Lightweight liveness probe against the public health route.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8001/api/health').status==200 else 1)" || exit 1

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8001"]
