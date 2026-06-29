import os
import re
import socket
import sys

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS

from routes.chat import chat_bp
from routes.demo import demo_bp
from routes.documents import documents_bp
from routes.generate import generate_bp
from routes.quiz import quiz_bp
from routes.upload import upload_bp

load_dotenv()

app = Flask(__name__)


def _configure_cors(flask_app: Flask) -> None:
    raw = os.environ.get("CORS_ORIGINS", "http://localhost:5173")
    explicit = [origin.strip() for origin in raw.split(",") if origin.strip()]

    origins: list = list(explicit)
    # Allow every Vercel deployment URL (preview hashes change on each deploy)
    origins.append(re.compile(r"https://[\w-]+\.vercel\.app"))

    CORS(flask_app, origins=origins)


_configure_cors(app)

app.register_blueprint(upload_bp)
app.register_blueprint(generate_bp)
app.register_blueprint(chat_bp)
app.register_blueprint(documents_bp)
app.register_blueprint(demo_bp)
app.register_blueprint(quiz_bp)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/health")
def api_health():
    return {"status": "ok"}


def _port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        return sock.connect_ex(("127.0.0.1", port)) == 0


def _resolve_port() -> int:
    if os.environ.get("PORT"):
        return int(os.environ["PORT"])

    default_port = 5000
    if not _port_in_use(default_port):
        return default_port

    for fallback_port in range(5001, 5010):
        if not _port_in_use(fallback_port):
            print(
                f"Port {default_port} is in use (on macOS this is usually AirPlay Receiver). "
                f"Starting on port {fallback_port} instead.",
                file=sys.stderr,
            )
            print(
                f"Set VITE_API_URL=http://localhost:{fallback_port} in frontend/.env "
                "and restart the Vite dev server.",
                file=sys.stderr,
            )
            os.environ["PORT"] = str(fallback_port)
            return fallback_port

    print(
        "Ports 5000–5009 are all in use. Stop other Flask processes or set PORT=... in .env",
        file=sys.stderr,
    )
    sys.exit(1)


if __name__ == "__main__":
    port = _resolve_port()

    is_reloader_child = os.environ.get("WERKZEUG_RUN_MAIN") == "true"
    if not is_reloader_child and _port_in_use(port):
        print(
            f"Port {port} is already in use. Choose another port via PORT=... in .env",
            file=sys.stderr,
        )
        sys.exit(1)

    app.run(host="0.0.0.0", port=port, debug=True)
