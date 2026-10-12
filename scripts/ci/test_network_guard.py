"""Subprocess probes: the guard applies before framework/provider imports."""

import os
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class GuardTests(unittest.TestCase):
    def probe(self, code):
        with tempfile.TemporaryDirectory() as directory:
            audit = Path(directory) / "audit"
            env = dict(
                os.environ,
                HYPOTHRON_CI_NETWORK_GUARD="1",
                HYPOTHRON_CI_NETWORK_AUDIT=str(audit),
                PYTHONPATH=str(ROOT / "scripts/ci/python"),
            )
            result = subprocess.run(
                [os.sys.executable, "-c", code],
                env=env,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            return audit.read_text() if audit.exists() else ""

    def test_caught_provider_dns_refusal_remains_auditable(self):
        log = self.probe(
            "import socket\ntry: socket.getaddrinfo('generativelanguage.googleapis.com',443)\nexcept PermissionError: pass\nelse: raise AssertionError('live DNS allowed')"
        )
        self.assertEqual(log, "CI_NETWORK_DENIED\n")

    def test_direct_ip_connect_ex_and_udp_cannot_bypass_guard(self):
        for expression in [
            "s.connect(('8.8.8.8',443))",
            "s.connect_ex(('8.8.8.8',443))",
            "s.sendto(b'probe',('8.8.8.8',53))",
        ]:
            log = self.probe(
                f"import socket\ns=socket.socket(socket.AF_INET,socket.SOCK_DGRAM)\ntry: {expression}\nexcept PermissionError: pass\nelse: raise AssertionError('network allowed')"
            )
            self.assertEqual(log, "CI_NETWORK_DENIED\n")

    def test_loopback_resolution_and_real_socket_still_work(self):
        self.assertEqual(
            self.probe(
                "import socket\nassert socket.getaddrinfo('localhost',80)\ns=socket.socket();s.bind(('127.0.0.1',0));s.listen();c=socket.create_connection(s.getsockname());c.close();s.close()"
            ),
            "",
        )

    def test_missing_audit_path_fails_closed(self):
        self.probe(
            "import socket,os\nos.environ.pop('HYPOTHRON_CI_NETWORK_AUDIT')\ntry: socket.getaddrinfo('openrouter.ai',443)\nexcept PermissionError: pass\nelse: raise AssertionError('allowed')"
        )


if __name__ == "__main__":
    unittest.main()
