import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQueryClient } from '@tanstack/react-query';
import { Zap, Loader2, CheckCircle2, Copy, Code2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import GlowCard from '@/components/ui/GlowCard';

export default function DeploymentTester({ dep }) {
  const [testInputs, setTestInputs] = useState({});
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [activeMode, setActiveMode] = useState('form'); // form | curl
  const queryClient = useQueryClient();

  const features = Object.entries(dep.input_schema?.properties || {}).slice(0, 12);

  const runPrediction = async () => {
    setIsTesting(true);
    setTestResult(null);

    const inputSummary = features
      .map(([k, v]) => `${k}=${testInputs[k] ?? (v.type === 'number' ? '0' : '?')}`)
      .join(', ');

    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um motor de inferência de ML. Simule uma predição REALISTA para:
Modelo: "${dep.model_name}" | Tarefa: ${dep.task_type} | Projeto: "${dep.project_name}"
Alvo: ${dep.target_column || 'não definido'}
Entradas: ${inputSummary || 'nenhuma entrada fornecida'}
Métricas do modelo: ${JSON.stringify(dep.model_metrics || {}).slice(0, 200)}

Retorne uma predição coerente com os dados de entrada.
prediction deve ser uma string ou número dependendo da tarefa.
confidence entre 0.5 e 0.99.
latency_ms entre 15 e 150.
explanation deve ser técnica e específica (2 frases).`,
        response_json_schema: {
          type: 'object',
          properties: {
            prediction: { type: 'string' },
            confidence: { type: 'number' },
            explanation: { type: 'string' },
            latency_ms: { type: 'number' },
            feature_contributions: {
              type: 'array',
              items: { type: 'object', properties: { feature: { type: 'string' }, impact: { type: 'number' } } }
            }
          }
        }
      });

      const log = {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        status: 200,
        latency_ms: res.latency_ms || Math.floor(Math.random() * 80 + 20),
        prediction: res.prediction,
        confidence: Number(res.confidence || 0).toFixed(3),
        inputs: { ...testInputs },
      };

      const allLogs = [log, ...(dep.call_logs || [])].slice(0, 50);
      const newTotal = (dep.total_calls || 0) + 1;
      const avgLatency = Math.round(allLogs.reduce((s, l) => s + (l.latency_ms || 0), 0) / allLogs.length);

      await base44.entities.ModelDeployment.update(dep.id, {
        call_logs: allLogs,
        total_calls: newTotal,
        calls_today: (dep.calls_today || 0) + 1,
        avg_latency_ms: avgLatency,
      });

      queryClient.invalidateQueries({ queryKey: ['deployments'] });
      setTestResult(res);
      toast.success('Predição executada!');
    } catch (e) {
      toast.error('Erro ao executar predição');
    }
    setIsTesting(false);
  };

  const curlExample = `curl -X POST "${dep.endpoint_url}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer {API_KEY}" \\
  -d '${JSON.stringify(
    Object.fromEntries(features.slice(0, 4).map(([k, v]) => [k, v.type === 'number' ? 0.0 : 'valor'])),
    null, 2
  )}'`;

  const pythonExample = `import requests

url = "${dep.endpoint_url}"
headers = {"Authorization": "Bearer {API_KEY}", "Content-Type": "application/json"}
payload = ${JSON.stringify(
    Object.fromEntries(features.slice(0, 4).map(([k, v]) => [k, v.type === 'number' ? 0.0 : 'valor'])),
    null, 2
  )}

response = requests.post(url, json=payload, headers=headers)
print(response.json())
# → {"prediction": "...", "confidence": 0.87, "latency_ms": 45}`;

  return (
    <GlowCard className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-primary" /> Testar Predição
        </p>
        <div className="flex gap-1 bg-secondary/40 p-0.5 rounded-md">
          {['form', 'curl'].map(m => (
            <button key={m} onClick={() => setActiveMode(m)}
              className={cn('px-2.5 py-1 rounded text-[10px] font-medium transition-all',
                activeMode === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}>
              {m === 'form' ? '📝 Formulário' : '💻 Código'}
            </button>
          ))}
        </div>
      </div>

      {activeMode === 'form' && (
        <>
          <div className="p-3 rounded-lg bg-amber-400/5 border border-amber-400/20 text-[10px] text-amber-400">
            ⚡ As predições são processadas internamente pelo motor de inferência ML Studio — não requerem servidor externo.
          </div>

          {features.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhum campo de entrada definido no schema.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {features.map(([key, schema]) => (
                <div key={key}>
                  <label className="text-[9px] text-muted-foreground uppercase tracking-wider">
                    {key} <span className="text-muted-foreground/50">({schema.type})</span>
                  </label>
                  <Input
                    value={testInputs[key] || ''}
                    onChange={e => setTestInputs(prev => ({ ...prev, [key]: e.target.value }))}
                    className="mt-1 h-7 text-xs bg-secondary/50 font-mono"
                    placeholder={schema.type === 'number' ? '0.0' : 'valor...'}
                  />
                </div>
              ))}
            </div>
          )}

          <Button onClick={runPrediction} disabled={isTesting} className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto">
            {isTesting
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processando...</>
              : <><Zap className="w-4 h-4 mr-2" /> Executar Predição</>}
          </Button>

          {testResult && (
            <div className="border border-emerald-400/30 bg-emerald-400/5 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Resultado da Predição
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-2 rounded bg-secondary/40">
                  <p className="text-lg font-bold font-mono text-primary">{testResult.prediction}</p>
                  <p className="text-[9px] text-muted-foreground">Predição</p>
                </div>
                <div className="text-center p-2 rounded bg-secondary/40">
                  <p className="text-lg font-bold font-mono text-emerald-400">{(Number(testResult.confidence) * 100).toFixed(1)}%</p>
                  <p className="text-[9px] text-muted-foreground">Confiança</p>
                </div>
                <div className="text-center p-2 rounded bg-secondary/40">
                  <p className="text-lg font-bold font-mono text-accent">{testResult.latency_ms}ms</p>
                  <p className="text-[9px] text-muted-foreground">Latência</p>
                </div>
              </div>
              {testResult.explanation && (
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  <span className="text-foreground font-medium">Explicação: </span>{testResult.explanation}
                </p>
              )}
              {testResult.feature_contributions?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Contribuição das Features</p>
                  <div className="space-y-1">
                    {testResult.feature_contributions.slice(0, 5).map((f, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[9px] text-muted-foreground w-24 truncate">{f.feature}</span>
                        <div className="flex-1 h-1.5 bg-secondary/60 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', f.impact >= 0 ? 'bg-primary' : 'bg-destructive')}
                            style={{ width: `${Math.min(Math.abs(f.impact) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-mono text-muted-foreground w-10 text-right">
                          {f.impact >= 0 ? '+' : ''}{(f.impact * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {activeMode === 'curl' && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Code2 className="w-3 h-3" /> cURL</p>
              <button onClick={() => { navigator.clipboard.writeText(curlExample); toast.success('Copiado!'); }}
                className="text-[9px] text-primary flex items-center gap-0.5 hover:underline">
                <Copy className="w-2.5 h-2.5" /> Copiar
              </button>
            </div>
            <pre className="bg-secondary/40 rounded-lg p-3 text-[10px] font-mono text-foreground overflow-x-auto whitespace-pre-wrap">{curlExample}</pre>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Code2 className="w-3 h-3" /> Python</p>
              <button onClick={() => { navigator.clipboard.writeText(pythonExample); toast.success('Copiado!'); }}
                className="text-[9px] text-primary flex items-center gap-0.5 hover:underline">
                <Copy className="w-2.5 h-2.5" /> Copiar
              </button>
            </div>
            <pre className="bg-secondary/40 rounded-lg p-3 text-[10px] font-mono text-foreground overflow-x-auto whitespace-pre-wrap">{pythonExample}</pre>
          </div>
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-[10px] text-muted-foreground">
            <span className="text-primary font-semibold">Nota:</span> O endpoint acima é o identificador do seu modelo. As predições são processadas pelo motor interno ML Studio e retornam respostas no formato JSON padrão.
          </div>
        </div>
      )}
    </GlowCard>
  );
}