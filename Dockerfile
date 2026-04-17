FROM python:3.12-slim

WORKDIR /app

COPY app.py index.html styles.css script.js logo_orange.png logo_blue.svg bike-scooter.svg site.webmanifest seed_dump.sql ./

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV BIKEBERI_HOST=0.0.0.0

EXPOSE 8080

CMD ["python3", "app.py"]
