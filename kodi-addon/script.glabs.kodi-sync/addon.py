import os
import sys

import xbmc
import xbmcaddon
import xbmcgui
import xbmcvfs


ADDON_PATH = os.path.dirname(os.path.abspath(__file__))
LIB_PATH = os.path.join(ADDON_PATH, "resources", "lib")

if LIB_PATH not in sys.path:
    sys.path.insert(0, LIB_PATH)

from kodi_sync import run_sync  # noqa: E402


def read_vfs_text(path, maximum_bytes):
    source = xbmcvfs.File(path)
    try:
        content = source.read(maximum_bytes + 1)
    finally:
        source.close()

    if isinstance(content, bytes):
        return content.decode("utf-8")
    return content


def log_diagnostic(message):
    xbmc.log("[script.glabs.kodi-sync] " + message, xbmc.LOGERROR)


def main():
    run_sync(
        addon=xbmcaddon.Addon(),
        dialog=xbmcgui.Dialog(),
        progress_factory=xbmcgui.DialogProgress,
        monitor=xbmc.Monitor(),
        translate_path=xbmcvfs.translatePath,
        read_vfs_text=read_vfs_text,
        logger=log_diagnostic,
    )


if __name__ == "__main__":
    main()
