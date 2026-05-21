//go:build ignore

package main

import (
	"bufio"
	"fmt"
	"os"
	"regexp"
	"sort"
	"strings"
)

func main() {
	if len(os.Args) < 3 {
		fmt.Println("用法: go run generate-settings-keys.go <main.go路径> <输出ts路径>")
		fmt.Println("示例: go run generate-settings-keys.go ../main.go settingsKeys.ts")
		os.Exit(1)
	}

	srcPath := os.Args[1]
	outPath := os.Args[2]

	data, err := os.ReadFile(srcPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "读取源文件失败: %v\n", err)
		os.Exit(1)
	}

	re := regexp.MustCompile("`json:\"([^\"]+)\"`")
	inSettings := false
	var keys []string
	skipTypes := map[string]bool{
		"MCPServer":   true,
		"EnvVar":      true,
		"SlashCommand": true,
	}

	scanner := bufio.NewScanner(strings.NewReader(string(data)))
	for scanner.Scan() {
		line := scanner.Text()
		if strings.Contains(line, "type Settings struct") {
			inSettings = true
			continue
		}
		if inSettings && strings.HasPrefix(line, "}") {
			break
		}
		if !inSettings {
			continue
		}
		for _, skipType := range []string{"[]MCPServer", "[]EnvVar", "[]SlashCommand", "[]string"} {
			if strings.Contains(line, skipType) {
				inSettings = false
				break
			}
		}
		matches := re.FindStringSubmatch(line)
		if len(matches) >= 2 {
			key := matches[1]
			if key != "" && !strings.Contains(key, ",") && !skipTypes[key] {
				keys = append(keys, key)
			}
		}
	}

	sort.Strings(keys)

	var sb strings.Builder
	sb.WriteString(`/**
 * settingsKeys.ts — 由 generate-settings-keys.go 自动生成
 *
 * ⚠️ 请勿手动编辑此文件！修改后端 Settings struct 后重新运行:
 *   go run scripts/generate-settings-keys.go main.go frontend/src/settingsKeys.ts
 */

export const S = {
`)

	categories := map[string][]string{
		"工作模式":    {},
		"通知":       {},
		"外观":       {},
		"API":        {},
		"个性化/记忆": {},
		"Git":        {},
		"浏览器":     {},
		"计算机控制":  {},
	}

	modeCat := ""
	for _, k := range keys {
		switch {
		case strings.Contains(k, "work_mode") || strings.Contains(k, "perm") || strings.Contains(k, "review") || strings.Contains(k, "access") || strings.Contains(k, "shell") || strings.Contains(k, "open_target") || strings.Contains(k, "language") || strings.Contains(k, "hotkey") || strings.Contains(k, "ctrl_enter") || strings.Contains(k, "followup") || strings.Contains(k, "review_mode"):
			categories["工作模式"] = append(categories["工作模式"], k)
		case strings.Contains(k, "notify") || strings.Contains(k, "notification"):
			categories["通知"] = append(categories["通知"], k)
		case strings.Contains(k, "theme") || strings.Contains(k, "font_size"):
			categories["外观"] = append(categories["外观"], k)
		case strings.Contains(k, "api_key") || strings.Contains(k, "long_context"):
			categories["API"] = append(categories["API"], k)
		case strings.Contains(k, "personality") || strings.Contains(k, "custom_instructions") || strings.Contains(k, "auto_memory") || strings.Contains(k, "tool_memory") || strings.Contains(k, "message_history"):
			categories["个性化/记忆"] = append(categories["个性化/记忆"], k)
		case strings.Contains(k, "commit") || strings.Contains(k, "worktree"):
			categories["Git"] = append(categories["Git"], k)
		case strings.Contains(k, "browser") || strings.Contains(k, "domain") || strings.Contains(k, "selenium"):
			categories["浏览器"] = append(categories["浏览器"], k)
		case strings.Contains(k, "computer_control"):
			categories["计算机控制"] = append(categories["计算机控制"], k)
		default:
			categories["工作模式"] = append(categories["工作模式"], k)
		}
	}

	catOrder := []string{"工作模式", "通知", "外观", "API", "个性化/记忆", "Git", "浏览器", "计算机控制"}
	for _, cat := range catOrder {
		if len(categories[cat]) == 0 {
			continue
		}
		sb.WriteString(fmt.Sprintf("\n  // ===== %s =====\n", cat))
		for _, k := range categories[cat] {
			sb.WriteString(fmt.Sprintf("  %s: '%s',\n", k, k))
		}
	}

	sb.WriteString(`} as const;

export type SettingKey = typeof S[keyof typeof S];

/** 所有可设置的标量 key（用于 toggle/select/input 绑定） */
export const SCALAR_KEYS: readonly SettingKey[] = [
`)
	for _, k := range keys {
		if !strings.Contains(k, "servers") && !strings.Contains(k, "vars") && !strings.Contains(k, "commands") && !strings.Contains(k, "sessions") {
			sb.WriteString(fmt.Sprintf("  S.%s,\n", k))
		}
	}
	sb.WriteString("] as const;\n")

	if err := os.WriteFile(outPath, []byte(sb.String()), 0644); err != nil {
		fmt.Fprintf(os.Stderr, "写入失败: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("✅ 已生成 %s (%d 个字段)\n", outPath, len(keys))
}
