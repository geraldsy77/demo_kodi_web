import json
import ipaddress
import re
import socket
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from contextlib import contextmanager


START_PATH = "/api/internal/sync/runs"
POLL_SECONDS = 2
TIMEOUT_SECONDS = 15 * 60
REQUEST_TIMEOUT_SECONDS = 20
MAX_RESPONSE_BYTES = 64 * 1024
MAX_CA_BYTES = 64 * 1024
FAILURE_CODE_PATTERN = re.compile(r"^[A-Z0-9_]{1,64}$")


class SyncError(Exception):
    pass


class ConfigurationError(SyncError):
    pass


class AuthenticationError(SyncError):
    pass


class AlreadyRunningError(SyncError):
    pass


class CertificateError(SyncError):
    pass


class NetworkError(SyncError):
    pass


class ServiceError(SyncError):
    pass


class InvalidResponseError(SyncError):
    pass


def localized(addon, string_id, *values):
    message = addon.getLocalizedString(string_id)
    return message.format(*values) if values else message


def normalize_base_url(value):
    candidate = value.strip().rstrip("/")
    parsed = urllib.parse.urlsplit(candidate)

    if (
        parsed.scheme.lower() != "https"
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.path not in ("", "/")
        or parsed.query
        or parsed.fragment
    ):
        raise ConfigurationError()

    return urllib.parse.urlunsplit(("https", parsed.netloc, "", "", ""))


def normalize_connect_ip(value):
    candidate = value.strip()
    if not candidate:
        return None

    try:
        return str(ipaddress.ip_address(candidate))
    except ValueError:
        raise ConfigurationError() from None


@contextmanager
def override_host_resolution(hostname, connect_ip):
    if not connect_ip:
        yield
        return

    original_getaddrinfo = socket.getaddrinfo
    normalized_hostname = hostname.lower().rstrip(".")

    def getaddrinfo(host, port, *args, **kwargs):
        candidate = host.lower().rstrip(".") if isinstance(host, str) else host
        resolved_host = connect_ip if candidate == normalized_hostname else host
        return original_getaddrinfo(resolved_host, port, *args, **kwargs)

    socket.getaddrinfo = getaddrinfo
    try:
        yield
    finally:
        socket.getaddrinfo = original_getaddrinfo


def normalize_run_id(value):
    if not isinstance(value, str):
        raise InvalidResponseError()

    try:
        normalized = str(uuid.UUID(value))
    except (ValueError, AttributeError, TypeError):
        raise InvalidResponseError() from None

    if normalized != value.lower():
        raise InvalidResponseError()

    return normalized


def is_nonnegative_integer(value):
    return isinstance(value, int) and not isinstance(value, bool) and value >= 0


def require_nonempty_string(value):
    if not isinstance(value, str) or not value:
        raise InvalidResponseError()
    return value


def validate_start_response(payload):
    if not isinstance(payload, dict) or payload.get("state") != "running":
        raise InvalidResponseError()

    run_id = normalize_run_id(payload.get("runId"))
    require_nonempty_string(payload.get("startedAt"))

    if payload.get("statusUrl") != START_PATH + "/" + run_id:
        raise InvalidResponseError()

    return run_id


def validate_status_response(payload, expected_run_id):
    if not isinstance(payload, dict):
        raise InvalidResponseError()

    run_id = normalize_run_id(payload.get("runId"))
    if run_id != expected_run_id:
        raise InvalidResponseError()

    state = payload.get("state")
    if state not in ("running", "success", "failure"):
        raise InvalidResponseError()

    require_nonempty_string(payload.get("startedAt"))

    if state == "running":
        if payload.get("completedAt") is not None:
            raise InvalidResponseError()
    else:
        require_nonempty_string(payload.get("completedAt"))

    if state == "success":
        if not is_nonnegative_integer(payload.get("movieCount")):
            raise InvalidResponseError()
        if not is_nonnegative_integer(payload.get("tvShowCount")):
            raise InvalidResponseError()
        if payload.get("failureCode") is not None:
            raise InvalidResponseError()

    if state == "failure":
        failure_code = payload.get("failureCode")
        if (
            not isinstance(failure_code, str)
            or not FAILURE_CODE_PATTERN.fullmatch(failure_code)
        ):
            raise InvalidResponseError()

    return payload


def is_certificate_failure(error):
    reason = getattr(error, "reason", None)
    return isinstance(error, ssl.SSLError) or isinstance(reason, ssl.SSLError)


def noop_logger(_message):
    pass


def safe_error_type(error):
    name = type(error).__name__
    return name if re.fullmatch(r"[A-Za-z0-9_]{1,64}", name) else "Error"


def log_network_failure(logger, error):
    reason = getattr(error, "reason", error)
    error_type = safe_error_type(reason)
    error_number = getattr(reason, "errno", None)
    if isinstance(error_number, int):
        logger("network_failure type={} errno={}".format(error_type, error_number))
    else:
        logger("network_failure type={}".format(error_type))


class SyncClient:
    def __init__(
        self,
        base_url,
        token,
        connect_ip="",
        ca_path="",
        translate_path=lambda value: value,
        read_vfs_text=None,
        opener=urllib.request.urlopen,
        logger=noop_logger,
    ):
        self.base_url = normalize_base_url(base_url)
        self.hostname = urllib.parse.urlsplit(self.base_url).hostname
        self.connect_ip = normalize_connect_ip(connect_ip)
        self.token = token.strip()
        self.opener = opener
        self.logger = logger

        if len(self.token) < 32:
            raise ConfigurationError()

        try:
            selected_ca_path = ca_path.strip()
            is_vfs_url = (
                selected_ca_path
                and "://" in selected_ca_path
                and not selected_ca_path.lower().startswith("special://")
            )
            if is_vfs_url:
                if read_vfs_text is None:
                    raise OSError()
                certificate_data = read_vfs_text(selected_ca_path, MAX_CA_BYTES)
                if not certificate_data or len(certificate_data.encode("utf-8")) > MAX_CA_BYTES:
                    raise OSError()
                self.context = ssl.create_default_context(cadata=certificate_data)
            else:
                translated_ca_path = (
                    translate_path(selected_ca_path) if selected_ca_path else None
                )
                self.context = ssl.create_default_context(cafile=translated_ca_path)
        except (OSError, RuntimeError, UnicodeError, ssl.SSLError) as error:
            logger("certificate_configuration_failure type={}".format(safe_error_type(error)))
            raise CertificateError() from None

    def request_json(self, path, method="GET"):
        if path != START_PATH and not path.startswith(START_PATH + "/"):
            raise ConfigurationError()

        body = b"{}" if method == "POST" else None
        headers = {
            "Accept": "application/json",
            "Authorization": "Bearer " + self.token,
        }
        if body is not None:
            headers["Content-Type"] = "application/json"

        request = urllib.request.Request(
            self.base_url + path,
            data=body,
            method=method,
            headers=headers,
        )

        try:
            with override_host_resolution(self.hostname, self.connect_ip):
                with self.opener(
                    request,
                    timeout=REQUEST_TIMEOUT_SECONDS,
                    context=self.context,
                ) as response:
                    content = response.read(MAX_RESPONSE_BYTES + 1)
        except urllib.error.HTTPError as error:
            self.logger("http_failure status={}".format(error.code))
            if error.code in (401, 403):
                raise AuthenticationError() from None
            if error.code == 409:
                raise AlreadyRunningError() from None
            raise ServiceError() from None
        except (ssl.SSLError, urllib.error.URLError, TimeoutError, OSError) as error:
            if is_certificate_failure(error):
                self.logger("certificate_verification_failure")
                raise CertificateError() from None
            log_network_failure(self.logger, error)
            raise NetworkError() from None

        if len(content) > MAX_RESPONSE_BYTES:
            raise InvalidResponseError()

        try:
            return json.loads(content.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise InvalidResponseError() from None

    def start(self):
        return validate_start_response(self.request_json(START_PATH, method="POST"))

    def status(self, run_id):
        normalized_run_id = normalize_run_id(run_id)
        path = START_PATH + "/" + urllib.parse.quote(normalized_run_id, safe="")
        return validate_status_response(
            self.request_json(path),
            normalized_run_id,
        )


def run_sync(
    addon,
    dialog,
    progress_factory,
    monitor,
    translate_path=lambda value: value,
    opener=urllib.request.urlopen,
    now=time.monotonic,
    poll_seconds=POLL_SECONDS,
    timeout_seconds=TIMEOUT_SECONDS,
    read_vfs_text=None,
    logger=noop_logger,
):
    title = localized(addon, 32100)
    base_url = addon.getSettingString("base_url")
    connect_ip = addon.getSettingString("connect_ip")
    token = addon.getSettingString("trigger_token")
    ca_path = addon.getSettingString("ca_path")

    try:
        client = SyncClient(
            base_url=base_url,
            token=token,
            connect_ip=connect_ip,
            ca_path=ca_path,
            translate_path=translate_path,
            read_vfs_text=read_vfs_text,
            opener=opener,
            logger=logger,
        )
    except ConfigurationError:
        dialog.ok(title, localized(addon, 32101))
        return "configuration_error"
    except CertificateError:
        dialog.ok(title, localized(addon, 32109))
        return "certificate_error"

    if not dialog.yesno(title, localized(addon, 32102)):
        return "declined"

    progress = progress_factory()
    progress.create(title, localized(addon, 32103))

    try:
        run_id = client.start()
        deadline = now() + timeout_seconds

        while now() < deadline:
            if progress.iscanceled():
                dialog.ok(title, localized(addon, 32112))
                return "cancelled"

            status = client.status(run_id)
            state = status["state"]

            if state == "success":
                dialog.ok(
                    title,
                    localized(
                        addon,
                        32105,
                        status["movieCount"],
                        status["tvShowCount"],
                    ),
                )
                return "success"

            if state == "failure":
                dialog.ok(
                    title,
                    localized(addon, 32110, status["failureCode"]),
                )
                return "failure"

            elapsed = max(0, timeout_seconds - max(0, deadline - now()))
            percentage = min(95, int(elapsed / timeout_seconds * 100))
            progress.update(percentage, localized(addon, 32104))

            if monitor.waitForAbort(poll_seconds):
                return "aborted"

        dialog.ok(title, localized(addon, 32111))
        return "timeout"
    except AuthenticationError:
        dialog.ok(title, localized(addon, 32106))
        return "authentication_error"
    except AlreadyRunningError:
        dialog.ok(title, localized(addon, 32107))
        return "already_running"
    except CertificateError:
        dialog.ok(title, localized(addon, 32109))
        return "certificate_error"
    except NetworkError:
        dialog.ok(title, localized(addon, 32108))
        return "network_error"
    except InvalidResponseError:
        dialog.ok(title, localized(addon, 32113))
        return "invalid_response"
    except ServiceError:
        dialog.ok(title, localized(addon, 32114))
        return "service_error"
    except Exception as error:
        logger("unexpected_failure type={}".format(safe_error_type(error)))
        dialog.ok(title, localized(addon, 32114))
        return "service_error"
    finally:
        progress.close()
