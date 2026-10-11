---
name: cheatsheets
description: "Kailash cheatsheets — patterns, nodes, workflows, cycles, perf, security, saga."
---

# Kailash Patterns - Quick Reference Cheatsheets

Comprehensive collection of quick reference guides, common patterns, and best practices for Kailash SDK development.

## When to Use

Use when asking about quick tips, cheat sheet, quick reference, common mistakes, node selection, workflow patterns library, cycle patterns, production patterns, performance optimization, monitoring, security config, multi-tenancy, distributed transactions, saga pattern, custom nodes, PythonCode data science, ollama integration, directoryreader patterns, or environment variables.

## Overview

This skill provides quick access to:

- Common workflow patterns and anti-patterns
- Node selection and usage guides
- Production-ready patterns
- Performance and optimization tips
- Security and enterprise patterns
- Integration cheatsheets

## Quick Reference Guides

### Essential Guides

- **[kailash-quick-tips](../../../.claude/skills/06-cheatsheets/kailash-quick-tips.md)** - Essential tips for Kailash development
- **[common-mistakes-catalog](../../../.claude/skills/06-cheatsheets/common-mistakes-catalog.md)** - Common pitfalls and solutions
- **[node-selection-guide](../../../.claude/skills/06-cheatsheets/node-selection-guide.md)** - Choosing the right nodes
- **[workflow-patterns-library](../../../.claude/skills/06-cheatsheets/workflow-patterns-library.md)** - Comprehensive pattern library
- **[README](../../../.claude/skills/06-cheatsheets/README.md)** - Cheatsheets overview

### Node References

- **[admin-nodes-reference](../../../.claude/skills/06-cheatsheets/admin-nodes-reference.md)** - Admin and management nodes
- **[asyncsql-advanced](../../../.claude/skills/06-cheatsheets/asyncsql-advanced.md)** - AsyncSQL node patterns
- **[pythoncode-data-science](../../../.claude/skills/06-cheatsheets/pythoncode-data-science.md)** - Data science with PythonCode
- **[directoryreader-patterns](../../../.claude/skills/06-cheatsheets/directoryreader-patterns.md)** - File system patterns
- **[ollama-integration](../../../.claude/skills/06-cheatsheets/ollama-integration.md)** - Local LLM integration
- **[query-builder](../../../.claude/skills/06-cheatsheets/query-builder.md)** - Query construction patterns
- **[query-routing](../../../.claude/skills/06-cheatsheets/query-routing.md)** - Intelligent query routing

### Cyclic Workflow Patterns

- **[cyclic-patterns-advanced](../../../.claude/skills/06-cheatsheets/cyclic-patterns-advanced.md)** - Advanced cyclic patterns
- **[cycle-aware-nodes](../../../.claude/skills/06-cheatsheets/cycle-aware-nodes.md)** - Cycle-aware node development
- **[cycle-debugging](../../../.claude/skills/06-cheatsheets/cycle-debugging.md)** - Debugging cyclic workflows
- **[cycle-testing](../../../.claude/skills/06-cheatsheets/cycle-testing.md)** - Testing cyclic workflows
- **[cycle-state-persistence](../../../.claude/skills/06-cheatsheets/cycle-state-persistence.md)** - State management in cycles
- **[cycle-scenarios](../../../.claude/skills/06-cheatsheets/cycle-scenarios.md)** - Real-world cycle scenarios
- **[multi-path-cycles](../../../.claude/skills/06-cheatsheets/multi-path-cycles.md)** - Multi-path cyclic patterns

### Production & Enterprise

- **[production-patterns](../../../.claude/skills/06-cheatsheets/production-patterns.md)** - Production-ready patterns
- **[production-readiness](../../../.claude/skills/06-cheatsheets/production-readiness.md)** - Production checklist
- **[performance-optimization](../../../.claude/skills/06-cheatsheets/performance-optimization.md)** - Performance tuning
- **[monitoring-alerting](../../../.claude/skills/06-cheatsheets/monitoring-alerting.md)** - Monitoring and alerting
- **[resilience-patterns](../../../.claude/skills/06-cheatsheets/resilience-patterns.md)** - Resilience and fault tolerance
- **[security-config](../../../.claude/skills/06-cheatsheets/security-config.md)** - Security configuration
- **[multi-tenancy-patterns](../../../.claude/skills/06-cheatsheets/multi-tenancy-patterns.md)** - Multi-tenant architectures

### Enterprise Patterns

- **[distributed-transactions](../../../.claude/skills/06-cheatsheets/distributed-transactions.md)** - Distributed transaction patterns
- **[saga-pattern](../../../.claude/skills/06-cheatsheets/saga-pattern.md)** - Saga pattern for long transactions
- **[enterprise-mcp](../../../.claude/skills/06-cheatsheets/enterprise-mcp.md)** - Enterprise MCP patterns
- **[a2a-coordination](../../../.claude/skills/06-cheatsheets/a2a-coordination.md)** - Agent-to-agent coordination
- **[mcp-resource-subscriptions](../../../.claude/skills/06-cheatsheets/mcp-resource-subscriptions.md)** - MCP resource patterns

### Development Tools

- **[custom-node-guide](../../../.claude/skills/06-cheatsheets/custom-node-guide.md)** - Creating custom nodes
- **[developer-tools](../../../.claude/skills/06-cheatsheets/developer-tools.md)** - Developer tooling
- **[node-initialization](../../../.claude/skills/06-cheatsheets/node-initialization.md)** - Node initialization patterns
- **[env-variables](../../../.claude/skills/06-cheatsheets/env-variables.md)** - Environment variable management
- **[validation-testing](../../../.claude/skills/06-cheatsheets/validation-testing.md)** - Validation and testing patterns
- **[visualization](../../../.claude/skills/06-cheatsheets/visualization.md)** - Workflow visualization

### Workflow Management

- **[workflow-composition](../../../.claude/skills/06-cheatsheets/workflow-composition.md)** - Composing complex workflows
- **[workflow-design-process](../../../.claude/skills/06-cheatsheets/workflow-design-process.md)** - Design process guide
- **[workflow-api-deployment](../../../.claude/skills/06-cheatsheets/workflow-api-deployment.md)** - Deploying workflows as APIs
- **[workflow-export](../../../.claude/skills/06-cheatsheets/workflow-export.md)** - Export and import patterns

### Integration Patterns

- **[data-integration](../../../.claude/skills/06-cheatsheets/data-integration.md)** - Data integration patterns
- **[integration-mastery](../../../.claude/skills/06-cheatsheets/integration-mastery.md)** - Advanced integration techniques

## Quick Patterns

### Basic Workflow

```python
from kailash.workflow.builder import WorkflowBuilder
from kailash.runtime import LocalRuntime

workflow = WorkflowBuilder()
workflow.add_node("NodeType", "node_id", {"param": "value"})
runtime = LocalRuntime()
results, run_id = runtime.execute(workflow.build())
```

### Common Node Selection

```python
# Data processing
workflow.add_node("PythonCode", "transform", {"code": "..."})

# API calls
workflow.add_node("HTTPRequest", "api", {"url": "...", "method": "GET"})

# AI/LLM
workflow.add_node("LLMNode", "chat", {"model": os.environ["LLM_MODEL"], "prompt": "..."})
```

### Cyclic Pattern

```python
workflow.add_node("LoopNode", "loop", {"max_iterations": 5})
workflow.add_node("ProcessNode", "process", {})
workflow.add_connection("loop", "item", "process", "input")
workflow.add_connection("process", "output", "loop", "feedback")
```

## CRITICAL Gotchas

| Rule                                                  | Why                                                    |
| ----------------------------------------------------- | ------------------------------------------------------ |
| ❌ NEVER use raw SQL                                  | Use DataFlow instead                                   |
| ✅ ALWAYS call `.build()`                             | Before `runtime.execute()`                             |
| ❌ NEVER use relative imports                         | Use absolute imports                                   |
| ❌ NEVER mock in Tier 2-3                             | Use real infrastructure                                |
| ❌ NEVER train sklearn/torch directly                 | Use `km.train(...)` (skill 34-kailash-ml)              |
| ✅ Cap parallel worktrees at 3 concurrent Opus agents | Beyond 3, budget exhaustion & merge conflicts dominate |

## When to Use This Skill

Use this skill when you need:

- Quick reference for common patterns
- Solution to a specific problem
- Best practices for production
- Node selection guidance
- Performance optimization tips
- Security configuration help
- Multi-tenancy patterns
- Cyclic workflow help

## Related Skills

- **[01-core-sdk](../../../.claude/skills/01-core-sdk/SKILL.md)** - Core SDK fundamentals
- **[08-nodes-reference](../../../.claude/skills/08-nodes-reference/SKILL.md)** - Node reference documentation
- **[17-gold-standards](../../../.claude/skills/17-gold-standards/SKILL.md)** - Mandatory best practices

## Support

For cheatsheet-related questions, invoke:

- `pattern-expert` - Pattern selection and usage
- `decide-framework` skill - Choose appropriate patterns for your use case
