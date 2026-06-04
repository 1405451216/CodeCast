# AP Deep Integration — Master Index

**Goal:** 将 AgentPrimordia (AP) 框架与 CodeCast 从 26% 集成度提升至 ~97%，实现完美深度融合。

**Dependency Chain:** Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5（严格顺序）

| Phase | Plan File | Integration % | Key Deliverables |
|-------|-----------|---------------|------------------|
| 1 | [phase1](2026-06-04-ap-deep-integration-phase1.md) | 26% → 42% | 激活 MCPRegistry、Lifecycle、CheckpointStore、Metrics |
| 2 | [phase2](2026-06-04-ap-deep-integration-phase2.md) | 42% → 55% | 替换 shell.go 安全层为 AP ACL+Sandbox，合并 metrics，FileLockManager |
| 3 | [phase3](2026-06-04-ap-deep-integration-phase3.md) | 55% → 72% | DAG/Pipeline/Handoff 编排，DocumentPipeline，CapabilityAgent |
| 4 | [phase4](2026-06-04-ap-deep-integration-phase4.md) | 72% → 86% | CostTracker，高级缓存，Summarizer，StructuredExtractor |
| 5 | [phase5](2026-06-04-ap-deep-integration-phase5.md) | 86% → 97% | Multimodal，OTLP 可观测性，PluginLoader/MessageBus，Guardrail 增强 |

## Execution Notes

- 每个 Phase 内的子任务可以并行执行
- 每个 Phase 结束后必须通过完整测试验证再进入下一 Phase
- AP pkg 需要在 Phase 4 前导出 CostTracker 类型
- Phase 3 的 CapabilityAgent 重构为 Phase 4/5 的 per-agent 能力注入铺路
