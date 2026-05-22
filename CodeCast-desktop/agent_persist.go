package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// getAgentStorePath returns the base path for agent state files
func getAgentStorePath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		home = "."
	}
	return filepath.Join(home, ".codecast", "agents")
}

// saveAgentState persists the agent's current state to disk
func saveAgentState(agent *SubAgent) error {
	dir := filepath.Join(getAgentStorePath(), agent.SessionID)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("创建目录失败: %v", err)
	}

	filePath := filepath.Join(dir, agent.ID+".json")
	data, err := json.MarshalIndent(agent, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化失败: %v", err)
	}

	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return fmt.Errorf("写入文件失败: %v", err)
	}

	return nil
}

// loadAgentState loads an agent's state from disk
func loadAgentState(sessionID, agentID string) (*SubAgent, error) {
	filePath := filepath.Join(getAgentStorePath(), sessionID, agentID+".json")
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("读取文件失败: %v", err)
	}

	var agent SubAgent
	if err := json.Unmarshal(data, &agent); err != nil {
		return nil, fmt.Errorf("解析失败: %v", err)
	}

	return &agent, nil
}

// listAgentsBySession returns all persisted agents for a session
func listAgentsBySession(sessionID string) ([]*SubAgent, error) {
	dir := filepath.Join(getAgentStorePath(), sessionID)
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	var agents []*SubAgent
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		agentID := entry.Name()[:len(entry.Name())-5] // strip .json
		agent, err := loadAgentState(sessionID, agentID)
		if err != nil {
			fmt.Printf("[AgentPersist] 加载 agent %s 失败: %v\n", agentID, err)
			continue
		}
		agents = append(agents, agent)
	}

	return agents, nil
}

// cleanupOldAgents removes agent files older than 7 days
func cleanupOldAgents() {
	basePath := getAgentStorePath()
	if _, err := os.Stat(basePath); os.IsNotExist(err) {
		return
	}

	cutoff := time.Now().Add(-7 * 24 * time.Hour)

	sessions, err := os.ReadDir(basePath)
	if err != nil {
		return
	}

	for _, sessionDir := range sessions {
		if !sessionDir.IsDir() {
			continue
		}
		sessionPath := filepath.Join(basePath, sessionDir.Name())
		entries, err := os.ReadDir(sessionPath)
		if err != nil {
			continue
		}

		allOld := true
		for _, entry := range entries {
			info, err := entry.Info()
			if err != nil {
				continue
			}
			if info.ModTime().After(cutoff) {
				allOld = false
				break
			}
		}

		if allOld && len(entries) > 0 {
			os.RemoveAll(sessionPath)
			fmt.Printf("[AgentPersist] 清理过期 session 目录: %s\n", sessionDir.Name())
		}
	}
}
