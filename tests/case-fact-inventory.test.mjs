import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const factInventory = {
  'apache-kafka-consumer-groups.mdx': [
    'retention.ms',
    'retention.bytes',
    'offsets.retention.minutes',
    'records-consumed-rate',
    'time-between-poll-max',
    'last-poll-seconds-ago',
    'kafka-consumer-groups.sh --describe',
    'sendOffsetsToTransaction',
    'onPartitionsRevoked',
    'onPartitionsAssigned',
    'commitAsync',
    'ClassicKafkaConsumer.pollForFetches',
    'FetchCollector.collectFetch',
    'CompletedFetch.fetchRecords',
  ],
  'aws-cell-shuffle-sharding.mdx': [
    'admission_state',
    'cell_version',
    'deadline',
    'executor_shard_ids',
    'max_external_writes',
    'max_model_requests',
    'max_queue_age',
    'max_tokens',
    'max_tool_calls',
    'NoCapacity/NoShardAvailable',
    'operation_id',
    'placement_epoch',
    'queue_shard_ids',
    'retry_after',
    'run_id',
    'shard_algorithm_version',
  ],
  'aws-cli-agent-orchestrator.mdx': [
    'allowedTools',
    'cao:read/write/admin',
    'expected={research, implementation, review}',
    'task_id -> worktree -> branch -> write_scope',
  ],
  'cloudflare-durable-objects-workerd.mdx': [
    'idFromName(name)',
    'get(id)',
    'getByName(name)',
    '$workers.durableObjectId',
  ],
  'erlang-otp-supervision-tree.mdx': [
    'reached_max_restart_intensity',
    'succeeded',
    'retryable_failed',
    'non_retryable_failed',
    'needs_review',
    '{M,F,A}',
    'DOWN',
    'EXIT',
  ],
  'google-adk-a2a.mdx': [
    'transfer_to_agent',
    'contextId',
    'taskId',
    'NotImplementedError(\'Cancellation is not supported\')',
  ],
  'kubeedge-cloud-edge-autonomy.mdx': [
    '等待恰好两个 heartbeat 周期',
    'max_offline_duration',
    'lease_id/policy/model/tool/security_epoch',
    'operation_id + device + base_version',
  ],
  'kubernetes-reconciliation-loop.mdx': [
    'AddAfter',
    'AddRateLimited',
    'Retry-After',
    'calculateStatus',
    'maxRetries = 15',
    'max_cost',
    'max_external_writes',
    'max_model_calls',
    'max_no_progress_rounds',
    'max_tokens',
    'max_tool_calls',
    'observed_version → new_status',
    'operation_id = hash(goal_id, generation, logical_step_id, canonical_action_intent)',
    'ownerReferences',
    'syncDeployment',
  ],
  'langgraph-supervisor.mdx': [
    'thread_id',
    'Command(resume=...)',
    'INVALID_CONCURRENT_GRAPH_UPDATE',
    'durability="sync"',
  ],
  'micro-frontends-single-spa.mdx': [
    'activeWhen(location)',
    'bootstrap',
    'unload',
    'SKIP_BECAUSE_BROKEN',
  ],
  'microsoft-multi-agent-reference-architecture.mdx': [
    'ToolPolicyGateway',
    'tenant_id',
    'correlation_id',
    'PolicyDecisionPoint',
  ],
  'openai-agents-sdk.mdx': [
    'current_agent',
    'RunState',
    'max_turns',
    'handoff_history_mapper',
  ],
  'ros2-dds-agent-lifecycle.mdx': [
    'ROS_SECURITY_STRATEGY=Enforce',
    'alive/configured/active/authorized',
    'is_canceling()',
    'canceled(result)',
    'CallbackReturn::ERROR',
  ],
  'temporal-saga-durable-execution.mdx': [
    'AddActivityTaskScheduledEvent',
    'WorkerControlTaskQueue',
    'cancelFromWorkerCommand',
    'sdk-go/internal_worker_heartbeat.go',
    'sdk-java/WorkerFactory.java',
    'tenant + operation + business_object + step_version',
    'failed=true',
    'compensated/已批准保留',
  ],
  'yjs-crdt-collaboration.mdx': [
    '(clientID, clock)',
    'Y.Doc.transact',
    'encodeStateVector',
    'gc = true',
  ],
};

test('preserves the reviewed operational fact inventory for every case', async () => {
  assert.equal(
    Object.keys(factInventory).length,
    15,
    'the inventory must cover every architecture case',
  );

  for (const [filename, facts] of Object.entries(factInventory)) {
    const source = await readFile(
      new URL(`../content/cases/${filename}`, import.meta.url),
      'utf8',
    );

    for (const fact of facts) {
      assert.ok(
        source.includes(fact),
        `${filename} lost reviewed fact or operational field: ${fact}`,
      );
    }
  }
});
