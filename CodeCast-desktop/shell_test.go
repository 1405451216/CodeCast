package main

import (
	"strings"
	"testing"
)

func TestRedactSensitiveOutput_KeyValuePatterns(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name  string
		input string
		want  string // should contain REDACTED and should NOT contain the original value
	}{
		{
			name:  "api_key=value",
			input: "api_key=sk-abc123def456",
			want:  "***REDACTED***",
		},
		{
			name:  "password=value",
			input: "password=mysecret123",
			want:  "***REDACTED***",
		},
		{
			name:  "token: value",
			input: "token: ghp_abc123def",
			want:  "***REDACTED***",
		},
		{
			name:  "no sensitive keys",
			input: "name=hello world=42",
			want:  "name=hello world=42",
		},
	}
	for _, tc := range cases {
		got := redactSensitiveOutput(tc.input)
		if tc.want == "***REDACTED***" && !strings.Contains(got, "***REDACTED***") {
			t.Errorf("%q: expected REDACTED in output, got %q", tc.name, got)
		}
		if tc.want != "***REDACTED***" && got != tc.want {
			t.Errorf("%q: got %q, want %q", tc.name, got, tc.want)
		}
	}
}

func TestRedactSensitiveOutput_KeyPrefixes(t *testing.T) {
	t.Parallel()
	// Test that sk- prefix is redacted
	input := "found sk-abc123def456ghi789 in output"
	got := redactSensitiveOutput(input)
	if !strings.Contains(got, "sk-***REDACTED***") {
		t.Errorf("expected sk- prefix to be redacted, got %q", got)
	}
	// Test ghp_ prefix independently
	input2 := "found ghp_xxxxxxxxxxxxxxxxxxxx in output"
	got2 := redactSensitiveOutput(input2)
	if !strings.Contains(got2, "ghp_***REDACTED***") {
		t.Errorf("expected ghp_ prefix to be redacted, got %q", got2)
	}
}

func TestRedactSensitiveOutput_MultipleOccurrences(t *testing.T) {
	t.Parallel()
	// M8 fix: verify that multiple occurrences of the same prefix are all redacted
	input := "sk-abc123 and sk-def456 and sk-ghi789"
	got := redactSensitiveOutput(input)
	count := strings.Count(got, "***REDACTED***")
	if count < 3 {
		t.Errorf("expected at least 3 redactions for 3 sk- prefixes, got %d redactions in %q", count, got)
	}
}

func TestMaskSensitiveValue(t *testing.T) {
	t.Parallel()
	cases := []struct {
		input, want string
	}{
		{"password=short", "password=***MASKED***"},
		{"api_key=sk-abc123def456ghi789jkl012mno345", "api_key=***MASKED***"},
		{"name=myproject", "name=myproject"},
		{"token=x", "token=***MASKED***"},
		{"noequalssign", "noequalssign"},
	}
	for _, tc := range cases {
		got := maskSensitiveValue(tc.input)
		if got != tc.want {
			t.Errorf("maskSensitiveValue(%q) = %q, want %q", tc.input, got, tc.want)
		}
	}
}

func TestSanitizePowerShellCommand_PercentNotExpanded(t *testing.T) {
	t.Parallel()
	// M8 fix: %VAR% should NOT be expanded in PowerShell.
	// In the old cmd.exe implementation, % was escaped to %% which was
	// ineffective (cmd.exe would still expand %VAR%).
	// In PowerShell, % is not a variable delimiter, so it passes through safely.
	input := "echo %USERNAME%"
	got := sanitizePowerShellCommand(input)
	if strings.Contains(got, "%%") {
		t.Errorf("PowerShell sanitizer should not double %%, got %q", got)
	}
	// % should pass through unchanged since it's not special in PowerShell
	if !strings.Contains(got, "%USERNAME%") {
		t.Errorf("%%VAR%% should be preserved unchanged in PowerShell, got %q", got)
	}
}

func TestSanitizePowerShellCommand_DollarEscaped(t *testing.T) {
	t.Parallel()
	// $ is the variable prefix in PowerShell and must be escaped
	cases := []struct {
		name, input, wantSubstring string
	}{
		{"dollar_var", "echo $HOME", "`$HOME"},
		{"dollar_env", "echo $env:PATH", "`$env:PATH"},
		{"dollar_in_double_quotes", "\"hello $world\"", "\"hello `$world\""},
	}
	for _, tc := range cases {
		got := sanitizePowerShellCommand(tc.input)
		if !strings.Contains(got, tc.wantSubstring) {
			t.Errorf("%s: expected %q in output, got %q", tc.name, tc.wantSubstring, got)
		}
	}
}

func TestSanitizePowerShellCommand_DollarInSingleQuotes(t *testing.T) {
	t.Parallel()
	// Single-quoted strings are literal in PowerShell — $ should NOT be escaped
	input := `'hello $world'`
	got := sanitizePowerShellCommand(input)
	if strings.Contains(got, "`$") {
		t.Errorf("$ inside single quotes should not be escaped, got %q", got)
	}
}

func TestSanitizePowerShellCommand_OperatorsEscaped(t *testing.T) {
	t.Parallel()
	// Pipe, redirect, semicolon etc. should be backtick-escaped outside quotes
	cases := []struct {
		name, input, wantSubstring string
	}{
		{"pipe", "dir | findstr foo", "`|"},
		{"redirect_out", "echo hello > file.txt", "`>"},
		{"redirect_in", "sort < input.txt", "`<"},
		{"semicolon", "cmd1; cmd2", "`;"},
		{"ampersand", "cmd1 & cmd2", "`&"},
		{"paren_open", "echo (hello)", "`("},
		{"paren_close", "echo (hello)", "`)"},
		{"brace_open", "echo {hello}", "`{"},
		{"brace_close", "echo {hello}", "`}"},
	}
	for _, tc := range cases {
		got := sanitizePowerShellCommand(tc.input)
		if !strings.Contains(got, tc.wantSubstring) {
			t.Errorf("%s: expected %q in output, got %q", tc.name, tc.wantSubstring, got)
		}
	}
}

func TestSanitizePowerShellCommand_BacktickEscaped(t *testing.T) {
	t.Parallel()
	// Backtick is PowerShell's escape character and must be doubled
	input := "echo `hello"
	got := sanitizePowerShellCommand(input)
	if !strings.Contains(got, "``") {
		t.Errorf("backtick should be doubled, got %q", got)
	}
}

func TestSanitizePowerShellCommand_NewlinesReplaced(t *testing.T) {
	t.Parallel()
	input := "echo hello\nworld"
	got := sanitizePowerShellCommand(input)
	if strings.Contains(got, "\n") {
		t.Errorf("newlines should be replaced with spaces, got %q", got)
	}
	if !strings.Contains(got, "echo hello world") {
		t.Errorf("expected newlines replaced with spaces, got %q", got)
	}
}

func TestSanitizePowerShellCommand_Empty(t *testing.T) {
	t.Parallel()
	got := sanitizePowerShellCommand("")
	if got != "" {
		t.Errorf("empty input should return empty, got %q", got)
	}
}

func TestSanitizeWindowsCommand_DelegatesToPowerShell(t *testing.T) {
	t.Parallel()
	// sanitizeWindowsCommand should now delegate to sanitizePowerShellCommand
	input := "echo %USERNAME%"
	gotPS := sanitizePowerShellCommand(input)
	gotWin := sanitizeWindowsCommand(input)
	if gotPS != gotWin {
		t.Errorf("sanitizeWindowsCommand should delegate to sanitizePowerShellCommand, got %q vs %q", gotWin, gotPS)
	}
}

func TestExtractCommandName(t *testing.T) {
	t.Parallel()
	cases := []struct {
		input, want string
	}{
		{"git status", "git"},
		{"npm install --save-dev", "npm"},
		{`"C:\Program Files\app\bin\app.exe" --flag`, `C:\Program Files\app\bin\app.exe`},
		{"go test ./...", "go"},
		{"python3 script.py", "python3"},
		{"", ""},
	}
	for _, tc := range cases {
		got := extractCommandName(tc.input)
		if got != tc.want {
			t.Errorf("extractCommandName(%q) = %q, want %q", tc.input, got, tc.want)
		}
	}
}
