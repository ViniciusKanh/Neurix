// Pipeline Executor — simulates real node-by-node execution using LLM for smart steps
import { base44 } from '@/api/base44Client';
import { NODE_TYPES } from '@/components/pipeline/NodeTypes';

function now() { return new Date().toISOString(); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Topological sort of nodes given edges
function topoSort(nodes, edges) {
  const inDegree = {};
  const adj = {};
  nodes.forEach(n => { inDegree[n.id] = 0; adj[n.id] = []; });
  edges.forEach(e => {
    if (adj[e.from]) adj[e.from].push(e.to);
    if (inDegree[e.to] !== undefined) inDegree[e.to]++;
  });
  const queue = nodes.filter(n => inDegree[n.id] === 0).map(n => n.id);
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    (adj[id] || []).forEach(nxt => {
      inDegree[nxt]--;
      if (inDegree[nxt] === 0) queue.push(nxt);
    });
  }
  return order.map(id => nodes.find(n => n.id === id)).filter(Boolean);
}

// Describe what a node does (for LLM prompt)
function describeNode(node) {
  const type = NODE_TYPES[node.type];
  const cfg = node.config || {};
  const lines = [`Type: ${node.type}`, `Label: ${node.label || type?.label || node.type}`];
  if (cfg.strategy) lines.push(`Strategy: ${cfg.strategy}`);
  if (cfg.method) lines.push(`Method: ${cfg.method}`);
  if (cfg.columns?.length) lines.push(`Columns: ${cfg.columns.join(', ')}`);
  if (cfg.target_column) lines.push(`Target: ${cfg.target_column}`);
  if (cfg.algorithm) lines.push(`Algorithm: ${cfg.algorithm}`);
  if (cfg.test_size) lines.push(`Test size: ${cfg.test_size}`);
  if (cfg.n_clusters) lines.push(`Clusters: ${cfg.n_clusters}`);
  if (cfg.formula) lines.push(`Formula: ${cfg.formula}`);
  if (cfg.condition) lines.push(`Condition: ${cfg.condition}`);
  if (cfg.n_components) lines.push(`Components: ${cfg.n_components}`);
  if (cfg.n_folds) lines.push(`K-Folds: ${cfg.n_folds}`);
  if (cfg.n_iter) lines.push(`Iterations: ${cfg.n_iter}`);
  return lines.join('\n');
}

// Simulate execution of a single node using LLM
async function executeNode(node, projectData, prevRowCount) {
  const t0 = Date.now();
  const type = NODE_TYPES[node.type];

  // Pure deterministic nodes (no LLM needed)
  const deterministicTypes = ['data_source', 'filter_rows', 'select_columns', 'sort_rows', 'split', 'cross_validation', 'output', 'evaluator', 'explain'];

  if (deterministicTypes.includes(node.type)) {
    await sleep(300 + Math.random() * 400);
    let rowsOut = prevRowCount;
    let log = '';

    if (node.type === 'data_source') {
      rowsOut = projectData?.dataset_size || 1000;
      log = `Carregado dataset "${projectData?.name || 'projeto'}" com ${rowsOut} registros e ${projectData?.dataset_columns || '?'} colunas.`;
    } else if (node.type === 'filter_rows') {
      rowsOut = Math.floor(prevRowCount * (0.7 + Math.random() * 0.25));
      log = `Filtro aplicado: ${prevRowCount - rowsOut} registros removidos. Restantes: ${rowsOut}.`;
    } else if (node.type === 'select_columns') {
      const cols = node.config?.columns || [];
      log = `${cols.length > 0 ? cols.length : 'Todas as'} colunas selecionadas. Registros: ${rowsOut}.`;
    } else if (node.type === 'sort_rows') {
      log = `Dados ordenados por "${node.config?.column || 'índice'}" (${node.config?.ascending !== false ? 'crescente' : 'decrescente'}).`;
    } else if (node.type === 'split') {
      const testPct = Math.round((node.config?.test_size || 0.2) * 100);
      const trainN = Math.floor(prevRowCount * (1 - (node.config?.test_size || 0.2)));
      const testN = prevRowCount - trainN;
      log = `Dataset dividido: Treino=${trainN} (${100 - testPct}%), Teste=${testN} (${testPct}%). Seed=${node.config?.random_state || 42}.`;
    } else if (node.type === 'cross_validation') {
      log = `Cross-validation configurado: K=${node.config?.n_folds || 5} folds${node.config?.stratified ? ' estratificados' : ''}.`;
    } else if (node.type === 'evaluator') {
      const acc = (0.72 + Math.random() * 0.22).toFixed(4);
      const f1 = (0.68 + Math.random() * 0.25).toFixed(4);
      log = `Avaliação concluída.\n  Accuracy: ${acc}\n  F1-Score: ${f1}\n  AUC-ROC: ${(parseFloat(acc) + 0.02).toFixed(4)}\n  Precision: ${(parseFloat(f1) + 0.01).toFixed(4)}\n  Recall: ${(parseFloat(f1) - 0.02).toFixed(4)}`;
    } else if (node.type === 'explain') {
      log = `SHAP values calculados. Top features identificadas. Relatório de explicabilidade gerado.`;
    } else if (node.type === 'output') {
      log = `Modelo/dados exportados com sucesso. Registros: ${rowsOut}.`;
    }

    return { status: 'success', duration_ms: Date.now() - t0, rows_in: prevRowCount, rows_out: rowsOut, log };
  }

  // LLM-assisted nodes
  try {
    const prompt = `You are a data pipeline executor. Simulate the execution of this ML pipeline node and return realistic logs.

Node details:
${describeNode(node)}

Input rows: ${prevRowCount}
Dataset context: ${projectData?.name || 'unknown dataset'}, ${projectData?.dataset_size || '?'} rows, columns: ${(projectData?.column_info || []).map(c => c.name).slice(0, 10).join(', ') || 'unknown'}

Return a JSON with:
- rows_out: number (rows after this step, realistic reduction if applicable)
- log: string (2-5 lines of realistic execution log with metrics, timings, counts)
- warning: string or null (any data quality warning)`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          rows_out: { type: 'number' },
          log: { type: 'string' },
          warning: { type: 'string' }
        }
      }
    });

    const rowsOut = result.rows_out || prevRowCount;
    let log = result.log || `Nó "${type?.label}" executado com sucesso.`;
    if (result.warning) log += `\n⚠ AVISO: ${result.warning}`;

    return { status: 'success', duration_ms: Date.now() - t0, rows_in: prevRowCount, rows_out: rowsOut, log };
  } catch (err) {
    return { status: 'failed', duration_ms: Date.now() - t0, rows_in: prevRowCount, rows_out: 0, log: '', error: err.message };
  }
}

// Main execution function — creates a PipelineExecution record and runs step by step
export async function executePipeline({ pipeline, nodes, edges, projectData, trigger = 'manual', onProgress, timeoutMinutes = 30 }) {
  const sortedNodes = topoSort(nodes, edges);
  const executionId = await _createExecution(pipeline, nodes, trigger);
  let currentRows = projectData?.dataset_size || 1000;
  const nodeLogs = [];
  const startedAt = now();
  const timeoutMs = timeoutMinutes * 60 * 1000;
  const startTime = Date.now();

  for (let i = 0; i < sortedNodes.length; i++) {
    const node = sortedNodes[i];
    const type = NODE_TYPES[node.type];
    const nodeLog = {
      node_id: node.id,
      node_name: node.label || type?.label || node.type,
      node_type: node.type,
      status: 'running',
      started_at: now(),
      rows_in: currentRows,
    };
    nodeLogs.push(nodeLog);

    onProgress?.({ status: 'running', currentNode: node, nodeIndex: i, total: sortedNodes.length, nodeLogs: [...nodeLogs] });

    // Update execution record
    await base44.entities.PipelineExecution.update(executionId, {
      status: 'running',
      completed_nodes: i,
      node_logs: [...nodeLogs],
    });

    // Timeout check
    if (Date.now() - startTime > timeoutMs) {
      nodeLog.status = 'failed';
      nodeLog.error = `Timeout: execução excedeu ${timeoutMinutes} minutos`;
      nodeLog.finished_at = now();
      await base44.entities.PipelineExecution.update(executionId, {
        status: 'timeout',
        finished_at: now(),
        error_message: `Timeout após ${timeoutMinutes} minutos`,
        node_logs: [...nodeLogs],
      });
      onProgress?.({ status: 'timeout', nodeLogs: [...nodeLogs] });
      return { status: 'timeout', executionId };
    }

    const result = await executeNode(node, projectData, currentRows);
    nodeLog.status = result.status;
    nodeLog.finished_at = now();
    nodeLog.duration_ms = result.duration_ms;
    nodeLog.rows_in = result.rows_in;
    nodeLog.rows_out = result.rows_out;
    nodeLog.log = result.log;
    nodeLog.error = result.error;

    if (result.status === 'failed') {
      await base44.entities.PipelineExecution.update(executionId, {
        status: 'failed',
        finished_at: now(),
        duration_seconds: Math.round((Date.now() - startTime) / 1000),
        failed_node: nodeLog.node_name,
        error_message: result.error,
        node_logs: [...nodeLogs],
        completed_nodes: i,
      });
      onProgress?.({ status: 'failed', failedNode: node, nodeLogs: [...nodeLogs] });
      return { status: 'failed', executionId };
    }

    currentRows = result.rows_out || currentRows;
  }

  const durationSeconds = Math.round((Date.now() - startTime) / 1000);
  await base44.entities.PipelineExecution.update(executionId, {
    status: 'success',
    finished_at: now(),
    duration_seconds: durationSeconds,
    completed_nodes: sortedNodes.length,
    node_logs: [...nodeLogs],
  });

  onProgress?.({ status: 'success', nodeLogs: [...nodeLogs] });
  return { status: 'success', executionId };
}

async function _createExecution(pipeline, nodes, trigger) {
  const exec = await base44.entities.PipelineExecution.create({
    pipeline_id: pipeline.id || 'unsaved',
    pipeline_name: pipeline.name,
    trigger,
    status: 'running',
    started_at: now(),
    total_nodes: nodes.length,
    completed_nodes: 0,
    node_logs: [],
    pipeline_snapshot: { nodes: nodes.map(n => ({ id: n.id, type: n.type, label: n.label, config: n.config })) },
  });
  return exec.id;
}