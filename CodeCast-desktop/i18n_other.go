//go:build !windows

package main

// detectSystemLocale is a no-op on non-Windows platforms.
// The caller falls back to LANG / LC_ALL / LANGUAGE environment variables.
func detectSystemLocale() Locale {
	return ""
}
