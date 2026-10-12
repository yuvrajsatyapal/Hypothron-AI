"""Test-only guard loaded by Python before application imports via PYTHONPATH.

Not a sandbox against hostile repository code. Prevents accidental real network
I/O even when provider exceptions are caught. Never logs addresses or payloads.
"""

import ipaddress
import os
import socket

ENABLED = os.environ.get("HYPOTHRON_CI_NETWORK_GUARD") == "1"


def deny():
    path = os.environ.get("HYPOTHRON_CI_NETWORK_AUDIT")
    if path:
        with open(path, "a", encoding="ascii") as audit:
            audit.write("CI_NETWORK_DENIED\n")
    raise PermissionError("CI_NETWORK_DENIED")


def check_host(host):
    if isinstance(host, bytes):
        host = host.decode("ascii")
    if host in (None, "", "localhost"):
        return
    try:
        if ipaddress.ip_address(host).is_loopback:
            return
    except ValueError:
        pass
    deny()


if ENABLED:
    original_resolve = socket.getaddrinfo
    original_connect = socket.socket.connect
    original_connect_ex = socket.socket.connect_ex
    original_sendto = socket.socket.sendto

    def resolve(host, *args, **kwargs):
        check_host(host)
        return original_resolve(host, *args, **kwargs)

    def check_address(sock, address):
        if sock.family in (socket.AF_INET, socket.AF_INET6):
            check_host(address[0])

    def connect(sock, address):
        check_address(sock, address)
        return original_connect(sock, address)

    def connect_ex(sock, address):
        check_address(sock, address)
        return original_connect_ex(sock, address)

    def sendto(sock, data, *args):
        check_address(sock, args[-1])
        return original_sendto(sock, data, *args)

    socket.getaddrinfo = resolve
    socket.socket.connect = connect
    socket.socket.connect_ex = connect_ex
    socket.socket.sendto = sendto
