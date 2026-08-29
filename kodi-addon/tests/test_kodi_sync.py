import json
import socket
import ssl
import sys
import unittest
import urllib.error
from pathlib import Path
from unittest import mock
from xml.etree import ElementTree


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
ADDON_ROOT = REPOSITORY_ROOT / "kodi-addon" / "script.glabs.kodi-sync"
LIB_ROOT = ADDON_ROOT / "resources" / "lib"
sys.path.insert(0, str(LIB_ROOT))

import kodi_sync  # noqa: E402


RUN_ID = "f1a0ac62-1bdf-4d10-a3c8-8512fc775e6d"
TOKEN = "t" * 32


def start_payload():
    return {
        "runId": RUN_ID,
        "state": "running",
        "startedAt": "2026-08-27T17:10:09.600Z",
        "statusUrl": "/api/internal/sync/runs/" + RUN_ID,
    }


def status_payload(state="running"):
    payload = {
        "runId": RUN_ID,
        "state": state,
        "startedAt": "2026-08-27T17:10:09.600Z",
        "completedAt": None,
        "movieCount": None,
        "tvShowCount": None,
        "failureCode": None,
    }
    if state == "success":
        payload.update(
            completedAt="2026-08-27T17:10:31.020Z",
            movieCount=38,
            tvShowCount=26,
        )
    if state == "failure":
        payload.update(
            completedAt="2026-08-27T17:10:31.020Z",
            failureCode="SYNC_FAILED",
        )
    return payload


class FakeResponse:
    def __init__(self, payload):
        if isinstance(payload, bytes):
            self.content = payload
        else:
            self.content = json.dumps(payload).encode("utf-8")

    def read(self, _limit):
        return self.content

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False


class QueueOpener:
    def __init__(self, *results):
        self.results = list(results)
        self.calls = []

    def __call__(self, request, **kwargs):
        self.calls.append((request, kwargs))
        result = self.results.pop(0)
        if isinstance(result, BaseException):
            raise result
        return FakeResponse(result)


class FakeAddon:
    def __init__(self, settings=None):
        self.settings = {
            "base_url": "https://kodi",
            "connect_ip": "",
            "trigger_token": TOKEN,
            "ca_path": "",
        }
        if settings:
            self.settings.update(settings)

    def getSettingString(self, setting_id):
        return self.settings[setting_id]

    def getLocalizedString(self, string_id):
        messages = {
            32100: "g's library sync",
            32101: "configuration error",
            32102: "confirm",
            32103: "starting",
            32104: "running",
            32105: "success {0} {1}",
            32106: "authentication error",
            32107: "already running",
            32108: "network error",
            32109: "certificate error",
            32110: "sync failure {0}",
            32111: "timeout",
            32112: "cancelled; NAS continues",
            32113: "invalid response",
            32114: "service error",
        }
        return messages[string_id]


class FakeDialog:
    def __init__(self, confirmed=True):
        self.confirmed = confirmed
        self.yesno_calls = []
        self.ok_calls = []

    def yesno(self, *values):
        self.yesno_calls.append(values)
        return self.confirmed

    def ok(self, *values):
        self.ok_calls.append(values)


class FakeProgress:
    def __init__(self, cancelled=False):
        self.cancelled = cancelled
        self.created = []
        self.updated = []
        self.closed = False

    def create(self, *values):
        self.created.append(values)

    def update(self, *values):
        self.updated.append(values)

    def iscanceled(self):
        return self.cancelled

    def close(self):
        self.closed = True


class FakeMonitor:
    def __init__(self, aborted=False):
        self.aborted = aborted
        self.waits = []

    def waitForAbort(self, seconds):
        self.waits.append(seconds)
        return self.aborted


class SequenceClock:
    def __init__(self, *values):
        self.values = iter(values)

    def __call__(self):
        return next(self.values)


class KodiSyncTests(unittest.TestCase):
    def run_flow(
        self,
        opener,
        *,
        addon=None,
        dialog=None,
        progress=None,
        monitor=None,
        now=lambda: 0,
        timeout_seconds=900,
        translate_path=lambda value: value,
        read_vfs_text=None,
        logger=kodi_sync.noop_logger,
    ):
        addon = addon or FakeAddon()
        dialog = dialog or FakeDialog()
        progress = progress or FakeProgress()
        monitor = monitor or FakeMonitor()

        with mock.patch.object(
            kodi_sync.ssl,
            "create_default_context",
            return_value=object(),
        ):
            result = kodi_sync.run_sync(
                addon=addon,
                dialog=dialog,
                progress_factory=lambda: progress,
                monitor=monitor,
                translate_path=translate_path,
                read_vfs_text=read_vfs_text,
                opener=opener,
                logger=logger,
                now=now,
                timeout_seconds=timeout_seconds,
            )

        return result, dialog, progress, monitor

    def test_confirmation_decline_does_not_call_http(self):
        opener = QueueOpener()
        result, dialog, progress, _monitor = self.run_flow(
            opener,
            dialog=FakeDialog(confirmed=False),
        )

        self.assertEqual(result, "declined")
        self.assertEqual(len(dialog.yesno_calls), 1)
        self.assertEqual(opener.calls, [])
        self.assertFalse(progress.created)

    def test_success_uses_fixed_urls_headers_and_displays_counts(self):
        opener = QueueOpener(start_payload(), status_payload("success"))
        result, dialog, progress, _monitor = self.run_flow(opener)

        self.assertEqual(result, "success")
        self.assertEqual(len(opener.calls), 2)
        start_request = opener.calls[0][0]
        status_request = opener.calls[1][0]
        self.assertEqual(
            start_request.full_url,
            "https://kodi/api/internal/sync/runs",
        )
        self.assertEqual(start_request.get_method(), "POST")
        self.assertEqual(start_request.data, b"{}")
        self.assertEqual(start_request.get_header("Authorization"), "Bearer " + TOKEN)
        self.assertEqual(start_request.get_header("Content-type"), "application/json")
        self.assertEqual(
            status_request.full_url,
            "https://kodi/api/internal/sync/runs/" + RUN_ID,
        )
        self.assertIn(("g's library sync", "success 38 26"), dialog.ok_calls)
        self.assertTrue(progress.closed)

    def test_non_https_configuration_is_rejected_before_confirmation(self):
        result, dialog, _progress, _monitor = self.run_flow(
            QueueOpener(),
            addon=FakeAddon({"base_url": "http://kodi"}),
        )

        self.assertEqual(result, "configuration_error")
        self.assertEqual(dialog.yesno_calls, [])

    def test_invalid_connect_ip_is_rejected_before_confirmation(self):
        result, dialog, _progress, _monitor = self.run_flow(
            QueueOpener(),
            addon=FakeAddon({"connect_ip": "nas.local"}),
        )

        self.assertEqual(result, "configuration_error")
        self.assertEqual(dialog.yesno_calls, [])

    def test_connect_ip_overrides_dns_but_preserves_url_host_and_tls_context(self):
        resolved_hosts = []
        context = object()

        def system_getaddrinfo(host, port, *args, **kwargs):
            resolved_hosts.append((host, port, args, kwargs))
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (host, port))]

        def resolving_opener(request, **kwargs):
            socket.getaddrinfo("kodi", 443, type=socket.SOCK_STREAM)
            self.assertEqual(request.full_url, "https://kodi/api/internal/sync/runs")
            self.assertIs(kwargs["context"], context)
            return FakeResponse(start_payload())

        with mock.patch.object(kodi_sync.socket, "getaddrinfo", system_getaddrinfo):
            with mock.patch.object(
                kodi_sync.ssl,
                "create_default_context",
                return_value=context,
            ):
                client = kodi_sync.SyncClient(
                    "https://kodi",
                    TOKEN,
                    connect_ip="192.168.0.3",
                    opener=resolving_opener,
                )
                client.request_json(kodi_sync.START_PATH, method="POST")

        self.assertEqual(resolved_hosts[0][0:2], ("192.168.0.3", 443))
        self.assertIs(kodi_sync.socket.getaddrinfo, socket.getaddrinfo)

    def test_only_manual_sync_paths_are_allowed(self):
        with mock.patch.object(kodi_sync.ssl, "create_default_context"):
            client = kodi_sync.SyncClient("https://kodi", TOKEN)

        with self.assertRaises(kodi_sync.ConfigurationError):
            client.request_json("/api/library/summary")

    def test_ca_path_is_translated_and_verification_stays_enabled(self):
        translate_path = mock.Mock(return_value="/trusted/kodi-ca.crt")

        with mock.patch.object(
            kodi_sync.ssl,
            "create_default_context",
            return_value=object(),
        ) as create_context:
            kodi_sync.SyncClient(
                "https://kodi",
                TOKEN,
                ca_path="special://home/kodi-ca.crt",
                translate_path=translate_path,
            )

        translate_path.assert_called_once_with("special://home/kodi-ca.crt")
        create_context.assert_called_once_with(cafile="/trusted/kodi-ca.crt")

    def test_nfs_ca_is_read_through_vfs_and_verification_stays_enabled(self):
        ca_path = "nfs://192.0.2.10/kodi-config/ca.crt"
        certificate = "-----BEGIN CERTIFICATE-----\ntrusted\n-----END CERTIFICATE-----"
        read_vfs_text = mock.Mock(return_value=certificate)
        translate_path = mock.Mock()

        with mock.patch.object(
            kodi_sync.ssl,
            "create_default_context",
            return_value=object(),
        ) as create_context:
            kodi_sync.SyncClient(
                "https://kodi",
                TOKEN,
                ca_path=ca_path,
                translate_path=translate_path,
                read_vfs_text=read_vfs_text,
            )

        read_vfs_text.assert_called_once_with(ca_path, kodi_sync.MAX_CA_BYTES)
        translate_path.assert_not_called()
        create_context.assert_called_once_with(cadata=certificate)

    def test_invalid_or_oversized_vfs_ca_is_rejected_without_logging_contents(self):
        sensitive_certificate = TOKEN + ("x" * kodi_sync.MAX_CA_BYTES)
        logs = []

        with self.assertRaises(kodi_sync.CertificateError):
            kodi_sync.SyncClient(
                "https://kodi",
                TOKEN,
                ca_path="nfs://192.0.2.10/kodi-config/ca.crt",
                read_vfs_text=lambda _path, _limit: sensitive_certificate,
                logger=logs.append,
            )

        self.assertTrue(logs)
        self.assertNotIn(TOKEN, repr(logs))
        self.assertNotIn("BEGIN CERTIFICATE", repr(logs))

    def test_authentication_error_has_distinct_message(self):
        error = urllib.error.HTTPError("https://kodi", 401, "secret", None, None)
        result, dialog, _progress, _monitor = self.run_flow(QueueOpener(error))

        self.assertEqual(result, "authentication_error")
        self.assertIn(("g's library sync", "authentication error"), dialog.ok_calls)

    def test_duplicate_run_has_distinct_message(self):
        error = urllib.error.HTTPError("https://kodi", 409, "busy", None, None)
        result, dialog, _progress, _monitor = self.run_flow(QueueOpener(error))

        self.assertEqual(result, "already_running")
        self.assertIn(("g's library sync", "already running"), dialog.ok_calls)

    def test_network_error_has_distinct_message(self):
        logs = []
        result, dialog, _progress, _monitor = self.run_flow(
            QueueOpener(urllib.error.URLError("private network details " + TOKEN)),
            logger=logs.append,
        )

        self.assertEqual(result, "network_error")
        self.assertIn(("g's library sync", "network error"), dialog.ok_calls)
        self.assertEqual(logs, ["network_failure type=str"])
        self.assertNotIn(TOKEN, repr(logs))

    def test_certificate_error_has_distinct_message(self):
        certificate_error = ssl.SSLCertVerificationError("private certificate details")
        result, dialog, _progress, _monitor = self.run_flow(
            QueueOpener(urllib.error.URLError(certificate_error))
        )

        self.assertEqual(result, "certificate_error")
        self.assertIn(("g's library sync", "certificate error"), dialog.ok_calls)

    def test_failure_state_displays_only_stable_failure_code(self):
        opener = QueueOpener(start_payload(), status_payload("failure"))
        result, dialog, _progress, _monitor = self.run_flow(opener)

        self.assertEqual(result, "failure")
        self.assertIn(("g's library sync", "sync failure SYNC_FAILED"), dialog.ok_calls)

    def test_timeout_is_bounded_and_distinct(self):
        opener = QueueOpener(start_payload(), status_payload("running"))
        clock = SequenceClock(0, 0, 0, 2)
        result, dialog, _progress, monitor = self.run_flow(
            opener,
            now=clock,
            timeout_seconds=1,
        )

        self.assertEqual(result, "timeout")
        self.assertIn(("g's library sync", "timeout"), dialog.ok_calls)
        self.assertEqual(monitor.waits, [2])

    def test_cancel_stops_polling_but_reports_nas_continues(self):
        opener = QueueOpener(start_payload())
        result, dialog, _progress, _monitor = self.run_flow(
            opener,
            progress=FakeProgress(cancelled=True),
        )

        self.assertEqual(result, "cancelled")
        self.assertEqual(len(opener.calls), 1)
        self.assertIn(
            ("g's library sync", "cancelled; NAS continues"),
            dialog.ok_calls,
        )

    def test_malformed_start_and_status_responses_are_rejected(self):
        malformed_results = (
            QueueOpener({"state": "running"}),
            QueueOpener(start_payload(), {"runId": RUN_ID, "state": "success"}),
        )

        for opener in malformed_results:
            with self.subTest(calls=len(opener.results)):
                result, dialog, _progress, _monitor = self.run_flow(opener)
                self.assertEqual(result, "invalid_response")
                self.assertIn(
                    ("g's library sync", "invalid response"),
                    dialog.ok_calls,
                )

    def test_exception_and_token_are_never_shown(self):
        sensitive_error = RuntimeError("failure contained " + TOKEN)
        result, dialog, _progress, _monitor = self.run_flow(
            QueueOpener(sensitive_error)
        )

        self.assertEqual(result, "service_error")
        displayed = repr(dialog.yesno_calls + dialog.ok_calls)
        self.assertNotIn(TOKEN, displayed)
        self.assertNotIn("failure contained", displayed)

    def test_manifest_settings_localization_and_icon_are_complete(self):
        manifest = ElementTree.parse(ADDON_ROOT / "addon.xml").getroot()
        settings = ElementTree.parse(ADDON_ROOT / "resources" / "settings.xml")

        self.assertEqual(manifest.attrib["id"], "script.glabs.kodi-sync")
        self.assertEqual(manifest.attrib["version"], "0.1.3")
        dependency = manifest.find("./requires/import")
        self.assertEqual(dependency.attrib["version"], "3.0.1")
        self.assertTrue((ADDON_ROOT / "addon.py").is_file())
        self.assertTrue((ADDON_ROOT / "resources" / "icon.png").is_file())
        self.assertTrue(
            (
                ADDON_ROOT
                / "resources"
                / "language"
                / "resource.language.en_gb"
                / "strings.po"
            ).is_file()
        )
        self.assertEqual(
            settings.find(".//setting[@id='base_url']/default").text,
            "https://kodi",
        )
        connect_ip_setting = settings.find(".//setting[@id='connect_ip']")
        self.assertEqual(connect_ip_setting.attrib["type"], "string")
        self.assertIsNone(connect_ip_setting.find("default").text)
        self.assertEqual(
            connect_ip_setting.find("constraints/allowempty").text,
            "true",
        )
        self.assertEqual(connect_ip_setting.find("control").attrib["type"], "edit")
        self.assertIsNone(settings.find(".//setting[@id='trigger_token']/default").text)
        ca_setting = settings.find(".//setting[@id='ca_path']")
        self.assertEqual(ca_setting.attrib["type"], "path")
        self.assertIsNone(ca_setting.find("default").text)
        self.assertEqual(ca_setting.find("constraints/writable").text, "false")
        self.assertEqual(ca_setting.find("constraints/allowempty").text, "true")
        self.assertEqual(ca_setting.find("control").attrib["type"], "button")
        self.assertEqual(ca_setting.find("control").attrib["format"], "file")


if __name__ == "__main__":
    unittest.main()
