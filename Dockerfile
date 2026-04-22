FROM python:3.12-slim

WORKDIR /app

COPY app.py index.html styles.css script.js site.webmanifest seed_dump.sql \
     logo_orange.png logo_blue.svg bike-scooter.svg \
     0F3E40D1-669A-4A7D-8A92-B59030ECB53B.PNG \
     2F25FE4D-B350-43A7-BFFF-71027B2F4466.PNG \
     icon-192.png icon-512.png apple-touch-icon.png \
     icon-192-v2.png icon-512-v2.png apple-touch-icon-v2.png \
     icon-192-v3.png icon-512-v3.png apple-touch-icon-v3.png \
     icon-full-1024.png icon-square-1024.png \
     icon-192-v4.png icon-512-v4.png apple-touch-icon-v4.png logo-v4.png \
     icon-192-v5.png icon-512-v5.png apple-touch-icon-v5.png logo-v5.png \
     icon-192-v6.png icon-512-v6.png apple-touch-icon-v6.png logo-v6.png \
     icon-192-v7.png icon-512-v7.png apple-touch-icon-v7.png logo-v7.png \
     icon-192-v8.png icon-512-v8.png apple-touch-icon-v8.png logo-v8.png \
     ./

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV BIKEBERI_HOST=0.0.0.0

EXPOSE 8080

CMD ["python3", "app.py"]
