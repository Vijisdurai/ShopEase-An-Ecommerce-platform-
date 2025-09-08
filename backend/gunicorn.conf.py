import multiprocessing
import os

# Server socket
bind = '0.0.0.0:8000'
backlog = 2048

# Worker processes
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = 'uvicorn.workers.UvicornWorker'
worker_connections = 1000
max_requests = 1000
timeout = 120
keepalive = 5

# Security
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190

# Debugging
debug = os.environ.get('DEBUG', 'false').lower() == 'true'
reload = debug

# Logging
loglevel = os.environ.get('LOG_LEVEL', 'info')
accesslog = '-'
errorlog = '-'
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(L)s %(D)s'

# Process naming
proc_name = 'ecommerce_api'

# Server hooks
def on_starting(server):
    server.log.info("Starting E-commerce API server")

def on_reload(server):
    server.log.info("Reloading E-commerce API server")

def when_ready(server):
    server.log.info("E-commerce API server is ready")

def worker_int(worker):
    worker.log.info("Worker received INT or QUIT signal")

def worker_abort(worker):
    worker.log.warning("Worker received SIGABRT signal")
