FROM python:3.12-slim

WORKDIR /app

COPY app.py index.html styles.css script.js ./

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV BIKEBERI_HOST=0.0.0.0
ENV PORT=8000

EXPOSE 8000

CMD ["python3", "app.py"]
