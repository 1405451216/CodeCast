package main

import "testing"

func TestCompareVersions(t *testing.T) {
	t.Parallel()
	cases := []struct{ a, b string; want int }{
		{"1.0.0", "1.0.1", -1},
		{"1.0.1", "1.0.0", 1},
		{"2.0.0", "1.9.9", 1},
		{"1.0.0", "1.0.0", 0},
		{"1.10.0", "1.9.0", 1},
		{"1.0.0", "2.0.0", -1},
		{"1.2.3", "1.2.3", 0},
		{"1.2", "1.2.0", 0},
		{"2.0", "1.9.9", 1},
		{"0.0.1", "0.0.0", 1},
		{"10.0.0", "9.0.0", 1},
	}
	for _, tc := range cases {
		got := compareVersions(tc.a, tc.b)
		if got != tc.want {
			t.Errorf("compareVersions(%q, %q) = %d, want %d", tc.a, tc.b, got, tc.want)
		}
	}
}

func TestParseVersionParts(t *testing.T) {
	t.Parallel()
	cases := []struct {
		input string
		want  []int
	}{
		{"1.0.0", []int{1, 0, 0}},
		{"v1.0.0", []int{1, 0, 0}},
		{"2.10.3", []int{2, 10, 3}},
		{"v2.10.3", []int{2, 10, 3}},
		{"1.0", []int{1, 0}},
		{"0.0.1", []int{0, 0, 1}},
		{"10.20.30", []int{10, 20, 30}},
	}
	for _, tc := range cases {
		got := parseVersionParts(tc.input)
		if len(got) != len(tc.want) {
			t.Errorf("parseVersionParts(%q) = %v, want %v", tc.input, got, tc.want)
			continue
		}
		for i := range got {
			if got[i] != tc.want[i] {
				t.Errorf("parseVersionParts(%q) = %v, want %v", tc.input, got, tc.want)
				break
			}
		}
	}
}
