FROM python:3.12-slim

WORKDIR /app

COPY app.py index.html styles.css script.js logo_orange.png logo_blue.svg bike-scooter.svg 0F3E40D1-669A-4A7D-8A92-B59030ECB53B.PNG 2F25FE4D-B350-43A7-BFFF-71027B2F4466.PNG site.webmanifest seed_dump.sql ./

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV BIKEBERI_HOST=0.0.0.0

EXPOSE 8080

CMD ["python3", "app.py"]
