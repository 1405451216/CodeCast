//go:build windows

package main

import (
	"log/slog"
	"syscall"
	"unsafe"
)

// detectSystemLocale uses the Windows GetUserDefaultLocaleName API
// to retrieve the user's locale (e.g. "zh-CN", "en-US").
// Returns empty Locale on failure so the caller can fall back to env vars.
func detectSystemLocale() Locale {
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	getLocale := kernel32.NewProc("GetUserDefaultLocaleName")

	buf := make([]uint16, 85) // LOCALE_NAME_MAX_LENGTH = 85
	r, _, err := getLocale.Call(uintptr(unsafe.Pointer(&buf[0])), uintptr(len(buf)))
	if r == 0 {
		slog.Warn("GetUserDefaultLocaleName failed", "error", err)
		return ""
	}

	name := syscall.UTF16ToString(buf)
	slog.Debug("Windows locale detected", "locale", name)
	return localeFromLangString(name)
}
