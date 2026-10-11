---
name: dataflow
description: "Kailash DataFlow — MANDATORY for DB/CRUD/bulk/migrations/multi-tenancy. Raw SQL/ORMs BLOCKED."
---

# Kailash DataFlow - Zero-Config Database Framework

DataFlow is a zero-config database framework built on Kailash Core SDK that automatically generates workflow nodes from database models.

## Overview

- **Automatic Node Generation**: 11 nodes per model (@db.model decorator)
- **Multi-Database Support**: PostgreSQL, MySQL, SQLite (SQL) + MongoDB (Document) + pgvector (Vector Search)
- **Enterprise Features**: Multi-tenancy, multi-instance isolation, transactions
- **Zero Configuration**: String IDs preserved, deferred schema operations
- **Developer Experience**: Enhanced errors (DF-XXX codes), strict mode validation, debug agent, CLI tools

## Quick Start

### Express API (Recommended for Simple CRUD)

```python
from dataflow import DataFlow

# Zero-config initialization
db = DataFlow("sqlite:///app.db", auto_migrate=True)

@db.model
class User:
    name: str
    email: str
    active: bool = True

await db.initialize()

# Async Express (default) — 23x faster than workflow primitives
result = await db.express.create("User", {"name": "Alice", "email": "alice@example.com"})
user = await db.express.read("User", result["id"])  # accepts both str and int IDs
users = await db.express.list("User", {"active": True})
count = await db.express.count("User")
await db.express.update("User", result["id"], {"name": "Bob"})
await db.express.delete("User", result["id"])

# Sync Express (CLI scripts, non-async contexts)
result = db.express_sync.create("User", {"name": "Alice", "email": "alice@example.com"})
users = db.express_sync.list("User", {"active": True})
```

### Workflow API (For Multi-Step Operations)

Use WorkflowBuilder only when you need multiple nodes with data flow between them.

```python
from kailash.workflow.builder import WorkflowBuilder
from kailash.runtime.local import LocalRuntime

# Multi-node workflow with connections
workflow = WorkflowBuilder()
workflow.add_node("User_Create", "create_user", {
    "data": {"name": "John", "email": "john@example.com"}
})

# Execute with context manager (recommended for resource cleanup)
with LocalRuntime() as runtime:
    results, run_id = runtime.execute(workflow.build())
    user_id = results["create_user"]["result"]  # Access pattern
```

## Generated Nodes (11 per model)

Each `@db.model` class generates:

1. `{Model}_Create` - Create single record
2. `{Model}_Read` - Read by ID
3. `{Model}_Update` - Update record
4. `{Model}_Delete` - Delete record
5. `{Model}_List` - List with filters
6. `{Model}_Upsert` - Insert or update (atomic)
7. `{Model}_Count` - Efficient COUNT(\*) queries
8. `{Model}_BulkCreate` - Bulk insert
9. `{Model}_BulkUpdate` - Bulk update
10. `{Model}_BulkDelete` - Bulk delete
11. `{Model}_BulkUpsert` - Bulk upsert

## Critical Rules

- ✅ String IDs preserved (no UUID conversion)
- ✅ Deferred schema operations (safe for Docker/async)
- ✅ Multi-instance isolation (one DataFlow per database)
- ✅ Result access: `results["node_id"]["result"]`
- ❌ NEVER use truthiness checks on filter/data parameters (empty dict `{}` is falsy)
- ❌ ALWAYS use key existence checks: `if "filter" in kwargs` instead of `if kwargs.get("filter")`
- ❌ NEVER use direct SQL when DataFlow nodes exist
- ❌ NEVER use SQLAlchemy/Django ORM alongside DataFlow

## Reference Documentation

### Getting Started

- **[dataflow-quickstart](../../../.claude/skills/02-dataflow/dataflow-quickstart.md)** - Quick start guide
- **[dataflow-installation](../../../.claude/skills/02-dataflow/dataflow-installation.md)** - Installation and setup
- **[dataflow-models](../../../.claude/skills/02-dataflow/dataflow-models.md)** - Defining models with @db.model
- **[dataflow-connection-config](../../../.claude/skills/02-dataflow/dataflow-connection-config.md)** - Database connection

### Core Operations

- **[dataflow-crud-operations](../../../.claude/skills/02-dataflow/dataflow-crud-operations.md)** - Create, Read, Update, Delete
- **[dataflow-queries](../../../.claude/skills/02-dataflow/dataflow-queries.md)** - Query patterns and filtering
- **[dataflow-aggregation](../../../.claude/skills/02-dataflow/dataflow-aggregation.md)** - SQL aggregation queries (COUNT/SUM/AVG/MIN/MAX GROUP BY)
- **[dataflow-bulk-operations](../../../.claude/skills/02-dataflow/dataflow-bulk-operations.md)** - Batch operations
- **[dataflow-transactions](../../../.claude/skills/02-dataflow/dataflow-transactions.md)** - Transaction management
- **[dataflow-connection-isolation](../../../.claude/skills/02-dataflow/dataflow-connection-isolation.md)** - ⚠️ CRITICAL: ACID guarantees

### Advanced Features

### Data Fabric Engine

- **[dataflow-fabric-engine](../../../.claude/skills/02-dataflow/dataflow-fabric-engine.md)** - External data sources (`db.source()`), derived products (`@db.product()`), fabric runtime (`db.start()`), 5 source adapters, webhooks, SSRF protection, observability

### Enterprise Features

- **[dataflow-derived-models](../../../.claude/skills/02-dataflow/dataflow-derived-models.md)** - Application-layer materialized views (`@db.derived_model`)
- **[dataflow-file-import](../../../.claude/skills/02-dataflow/dataflow-file-import.md)** - File ingestion (CSV/Excel/Parquet/JSON) + `db.express.import_file()`
- **[dataflow-validation-dsl](../../../.claude/skills/02-dataflow/dataflow-validation-dsl.md)** - Declarative validation (`__validation__` dict)
- **[dataflow-express-cache](../../../.claude/skills/02-dataflow/dataflow-express-cache.md)** - Model-scoped Express caching with TTL
- **[dataflow-read-replicas](../../../.claude/skills/02-dataflow/dataflow-read-replicas.md)** - Read/write splitting with `read_url`
- **[dataflow-retention](../../../.claude/skills/02-dataflow/dataflow-retention.md)** - Data retention (archive/delete/partition policies)
- **[dataflow-events](../../../.claude/skills/02-dataflow/dataflow-events.md)** - Write event emission + Core SDK EventBus integration

### Advanced Features

- **[dataflow-multi-instance](../../../.claude/skills/02-dataflow/dataflow-multi-instance.md)** - Multiple database instances
- **[dataflow-multi-tenancy](../../../.claude/skills/02-dataflow/dataflow-multi-tenancy.md)** - Multi-tenant architectures
- **[dataflow-existing-database](../../../.claude/skills/02-dataflow/dataflow-existing-database.md)** - Working with existing databases
- **[dataflow-migrations-quick](../../../.claude/skills/02-dataflow/dataflow-migrations-quick.md)** - Database migrations
- **[dataflow-custom-nodes](../../../.claude/skills/02-dataflow/dataflow-custom-nodes.md)** - Custom database nodes
- **[dataflow-sqlite-concurrency](../../../.claude/skills/02-dataflow/dataflow-sqlite-concurrency.md)** - SQLite connection pooling, WAL mode, read/write splitting, memory DB URI patterns

### Developer Experience Tools

- **[dataflow-strict-mode](../../../.claude/skills/02-dataflow/dataflow-strict-mode.md)** - Build-time validation (4-layer, OFF/WARN/STRICT)
- **[dataflow-debug-agent](../../../.claude/skills/02-dataflow/dataflow-debug-agent.md)** - Intelligent error analysis (5-stage pipeline)
- **ErrorEnhancer** - Automatic error enhancement (40+ DF-XXX codes)
- **Inspector API** - Self-service debugging (18 introspection methods)
- **CLI Tools** - dataflow-validate, dataflow-analyze, dataflow-debug (5 commands)

### Connection Pool & Monitoring

- **[dataflow-connection-config](../../../.claude/skills/02-dataflow/dataflow-connection-config.md)** - Pool auto-scaling, env vars, override scenarios
- **[dataflow-monitoring](../../../.claude/skills/02-dataflow/dataflow-monitoring.md)** - Pool utilization, leak detection, health checks, diagnostics

### ML Integration

- **[dataflow-ml-integration](../../../.claude/skills/02-dataflow/dataflow-ml-integration.md)** - kailash-ml FeatureStore integration (ConnectionManager, point-in-time queries, polars interop)

### Provenance & Audit

- **[dataflow-provenance-audit](../../../.claude/skills/02-dataflow/dataflow-provenance-audit.md)** - Provenance[T] field tracking, audit trail persistence, EventStoreBackend
- **[dataflow-fabric-cache-consumers](../../../.claude/skills/02-dataflow/dataflow-fabric-cache-consumers.md)** - Fabric cache control, consumer adapters, MCP tool generation

### Cache Patterns

- **[cache-cas-fail-closed](../../../.claude/skills/02-dataflow/cache-cas-fail-closed.md)** - CAS (compare-and-swap) fail-closed pattern when primitive can only be satisfied by one backend

### Troubleshooting

- **[dataflow-gotchas](../../../.claude/skills/02-dataflow/dataflow-gotchas.md)** - Common pitfalls

## Database Support Matrix

| Database   | Type     | Nodes/Model | Driver    |
| ---------- | -------- | ----------- | --------- |
| PostgreSQL | SQL      | 11          | asyncpg   |
| MySQL      | SQL      | 11          | aiomysql  |
| SQLite     | SQL      | 11          | aiosqlite |
| MongoDB    | Document | 8           | Motor     |
| pgvector   | Vector   | 3           | pgvector  |

**Not an ORM**: DataFlow generates workflow nodes, not ORM models. Uses string-based result access and integrates with Kailash's workflow execution model.

## Integration Patterns

### With Nexus (Multi-Channel)

```python
from dataflow import DataFlow
from nexus import Nexus

db = DataFlow(connection_string="...")
@db.model
class User:
    id: str
    name: str

# Auto-generates API + CLI + MCP
nexus = Nexus(db.get_workflows())
nexus.run()  # Instant multi-channel platform
```

### With Core SDK (Custom Workflows)

```python
from dataflow import DataFlow
from kailash.workflow.builder import WorkflowBuilder

db = DataFlow(connection_string="...")
# Use db-generated nodes in custom workflows
workflow = WorkflowBuilder()
workflow.add_node("User_Create", "user1", {...})
```

## When to Use This Skill

Use DataFlow when you need to:

- Perform database operations in workflows
- Generate CRUD APIs automatically (with Nexus)
- Implement multi-tenant systems
- Work with existing databases
- Build database-first applications
- Handle bulk data operations

## Related Skills

- **[01-core-sdk](../../../.claude/skills/01-core-sdk/SKILL.md)** - Core workflow patterns (canonical node pattern)
- **[03-nexus](../../../.claude/skills/03-nexus/SKILL.md)** - Multi-channel deployment
- **[04-kaizen](../../../.claude/skills/04-kaizen/SKILL.md)** - AI agent integration
- **[17-gold-standards](../../../.claude/skills/17-gold-standards/SKILL.md)** - Best practices

## Support

For DataFlow-specific questions, invoke:

- `dataflow-specialist` - DataFlow implementation and patterns
- `testing-specialist` - DataFlow testing strategies (NO MOCKING policy)
- ``decide-framework` skill` - Choose between Core SDK and DataFlow
