FROM decolua/9router:0.5.112

# Render injects PORT; keep a sane default for local runs.
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=20128 \
    DATA_DIR=/app/data

EXPOSE 20128

COPY entrypoint.sh /app/entrypoint.sh
COPY backup.js /app/backup.js
RUN chmod +x /app/entrypoint.sh

# entrypoint restores the SQLite DB from GitHub (if configured), starts the
# gateway, and periodically pushes the DB back so config survives restarts.
ENTRYPOINT ["/app/entrypoint.sh"]
