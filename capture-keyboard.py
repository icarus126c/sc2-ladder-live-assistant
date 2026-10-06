"""Read allowlisted key states only while the foreground process is StarCraft II.

No hook, injection, file logging, text reconstruction or network access is used.
Only the current frame is emitted to the parent assistant process.
"""
import argparse
import ctypes
from ctypes import wintypes
import json
import os
import sys
import time

KEYS = {**{chr(n): n for n in range(65, 91)},
        **{str(n): 48 + n for n in range(10)},
        **{f"F{n}": 111 + n for n in range(1, 13)},
        "CtrlLeft": 162, "CtrlRight": 163, "ShiftLeft": 160, "ShiftRight": 161,
        "AltLeft": 164, "AltRight": 165, "WinLeft": 91, "WinRight": 92,
        "Space": 32, "Tab": 9, "Enter": 13, "Escape": 27, "Backspace": 8,
        "CapsLock": 20, "Insert": 45, "Delete": 46, "Home": 36, "End": 35,
        "PageUp": 33, "PageDown": 34, "Backquote": 192, "Minus": 189, "Equal": 187,
        "BracketLeft": 219, "BracketRight": 221, "Backslash": 220, "Semicolon": 186,
        "Quote": 222, "Comma": 188, "Period": 190, "Slash": 191,
        "Up": 38, "Down": 40, "Left": 37, "Right": 39,
        "Mouse1": 1, "Mouse2": 2}


class ChatGuard:
    def __init__(self, enabled=True):
        self.enabled = enabled
        self.paused = self.enter_was_down = self.escape_was_down = False

    def update(self, focused, enter=False, escape=False):
        if not focused:
            self.enter_was_down = self.escape_was_down = False
            return self.paused
        if self.enabled:
            if enter and not self.enter_was_down:
                self.paused = not self.paused
            if escape and not self.escape_was_down:
                self.paused = False
        self.enter_was_down, self.escape_was_down = enter, escape
        return self.paused


def main():
    args = argparse.ArgumentParser()
    args.add_argument("--no-chat-guard", action="store_true")
    args.add_argument("--once", action="store_true")
    args.add_argument("--parent-pid", type=int)
    options = args.parse_args()
    if os.name != "nt":
        print(json.dumps({"status": "unsupported", "pressed": []}), flush=True)
        return
    user = ctypes.WinDLL("user32", use_last_error=True)
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    user.GetForegroundWindow.restype = wintypes.HWND
    user.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
    user.GetAsyncKeyState.argtypes = [ctypes.c_int]
    user.GetAsyncKeyState.restype = ctypes.c_short
    kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel.OpenProcess.restype = wintypes.HANDLE
    kernel.QueryFullProcessImageNameW.argtypes = [wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)]
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel.GetExitCodeProcess.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
    parent = kernel.OpenProcess(0x1000, False, options.parent_pid) if options.parent_pid else None
    if options.parent_pid and not parent:
        return

    def foreground_game():
        pid = wintypes.DWORD()
        user.GetWindowThreadProcessId(user.GetForegroundWindow(), ctypes.byref(pid))
        handle = kernel.OpenProcess(0x1000, False, pid.value)
        if not handle:
            return False
        try:
            name = ctypes.create_unicode_buffer(32768)
            length = wintypes.DWORD(len(name))
            if not kernel.QueryFullProcessImageNameW(handle, 0, name, ctypes.byref(length)):
                return False
            return os.path.basename(name.value).lower() in ("sc2.exe", "sc2_x64.exe")
        finally:
            kernel.CloseHandle(handle)

    def down(vk):
        return bool(user.GetAsyncKeyState(vk) & 0x8000)

    previous = None
    last_emit = last_focus = 0
    focused = False
    guard = ChatGuard(not options.no_chat_guard)
    while True:
        tick = time.monotonic()
        if parent:
            exit_code = wintypes.DWORD()
            if not kernel.GetExitCodeProcess(parent, ctypes.byref(exit_code)) or exit_code.value != 259:
                kernel.CloseHandle(parent)
                break
        if tick - last_focus >= 0.08:
            focused = foreground_game()
            last_focus = tick
        if focused:
            enter, escape = down(13), down(27)
            chat = guard.update(True, enter, escape)
            frame = {"status": "chat" if chat else "active",
                     "pressed": [] if chat else [key for key, vk in KEYS.items() if down(vk)]}
        else:
            guard.update(False)
            frame = {"status": "waiting", "pressed": []}
        if frame != previous or tick - last_emit >= 0.5:
            print(json.dumps(frame), flush=True)
            previous, last_emit = frame, tick
        if options.once:
            break
        time.sleep(0.016)


if __name__ == "__main__":
    try:
        main()
    except (BrokenPipeError, KeyboardInterrupt):
        pass
    except Exception:
        print(json.dumps({"status": "error", "pressed": []}), flush=True)
        sys.exit(1)
