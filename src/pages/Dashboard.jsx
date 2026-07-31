import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  FolderOpen, Database, Brain, BarChart3,
  Zap, Plus, Activity, GitBranch,
  TrendingUp, ArrowRight, Server
} from 'lucide-react';
import { motion } from 'framer-motion';
import GlowCard from '@/components/ui/GlowCard';
import { Button } from '@/components/ui/button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

function StatCard({ icon: Icon, label, value, sub, color = 'primary', linkTo }) {
  const colorMap = {
    primary: 'text-primary bg-primary/10',
    accent: 'text-accent bg-accent/10',
    chart3: 'text-chart-3 bg-chart-3/10',
    chart4: 'text-chart-4 bg-chart-4/10',
  };

  const content = (
    <GlowCard className="flex items-center gap-4 group h-full">
      <div className={`p-2.5 rounded-lg flex-shrink-0 ${colorMap[color] || colorMap.primary}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold font-mono tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {sub && <p className="text-[10px] text-primary/60 mt-0.5">{sub}</p>}
      </div>
    </GlowCard>
  );

  return linkTo ? <Link to={linkTo}>{content}</Link> : content;
}

function QuickAction({ icon: Icon, label, to, color = 'primary' }) {
  const colorClasses = {
    primary: 'hover:border-primary/50 hover:text-primary',
    accent: 'hover:border-accent/50 hover:text-accent',
    chart3: 'hover:border-chart-3/50 hover:text-chart-3',
    chart4: 'hover:border-chart-4/50 hover:text-chart-4',
  };

  return (
    <Link to={to}>
      <motion.div
        whileHover={{ y: -2 }}
        className={`flex flex-col items-center gap-2 p-4 rounded-lg border border-border/40 bg-card/50
          transition-all cursor-pointer ${colorClasses[color] || colorClasses.primary}`}
      >
        <Icon className="w-5 h-5" />
        <span className="text-xs font-medium text-center">{label}</span>
      </motion.div>
    </Link>
  );
}

export default function Dashboard() {
  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-updated_date', 50),
  });

  const { data: deployments = [], isLoading: loadingDeploy } = useQuery({
    queryKey: ['deployments'],
    queryFn: () => base44.entities.ModelDeployment.list('-updated_date', 50),
  });

  const { data: analyses = [], isLoading: loadingAnalyses } = useQuery({
    queryKey: ['analyses'],
    queryFn: () => base44.entities.Analysis.list('-updated_date', 50),
  });

  const isLoading = loadingProjects || loadingDeploy || loadingAnalyses;

  if (isLoading) return <LoadingSpinner text="Loading dashboard..." />;

  const activeDeployments = deployments.filter(d => d.status === 'active');
  const completedAnalyses = analyses.filter(a => a.status === 'completed');
  const completedProjects = projects.filter(p => p.status === 'completed');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <p className="text-xs text-primary/50 font-mono uppercase tracking-[0.2em]">[ overview ]</p>
        <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight">
          <span className="text-gradient-primary">Dashboard</span>
        </h1>
        <p className="text-sm text-muted-foreground">Modara MLOps Platform</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={FolderOpen}
          label="Projects"
          value={projects.length}
          sub={`${completedProjects.length} completed`}
          linkTo="/projects"
        />
        <StatCard
          icon={Server}
          label="Deployments"
          value={activeDeployments.length}
          color="accent"
          sub="in production"
          linkTo="/model-comparison-deployed"
        />
        <StatCard
          icon={Brain}
          label="Analyses"
          value={analyses.length}
          color="chart3"
          sub={`${completedAnalyses.length} completed`}
          linkTo="/ml-studio"
        />
        <StatCard
          icon={Database}
          label="Datasets"
          value={projects.filter(p => p.dataset_file_url).length}
          color="chart4"
          sub="with data"
          linkTo="/explorer"
        />
      </div>

      {/* Quick Actions */}
      <div>
        <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider mb-3">Quick Actions</p>
        <div className="grid grid-cols-4 md:grid-cols-4 lg:grid-cols-8 gap-2">
          <QuickAction icon={Plus} label="New Project" to="/projects/new" />
          <QuickAction icon={Server} label="Inferência" to="/inference" color="accent" />
          <QuickAction icon={Zap} label="AutoML" to="/automl" color="chart3" />
          <QuickAction icon={BarChart3} label="Reports" to="/reports" color="chart4" />
          <QuickAction icon={Activity} label="Monitoring" to="/monitoring" />
          <QuickAction icon={GitBranch} label="A/B Test" to="/ab-test" color="accent" />
          <QuickAction icon={Brain} label="ML Studio" to="/ml-studio" color="chart3" />
          <QuickAction icon={TrendingUp} label="Analytics" to="/analytics" color="chart4" />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Projects */}
        <GlowCard>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-primary" />
              Recent Projects
            </h3>
            <Link to="/projects" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {projects.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No projects yet</p>
          ) : (
            <div className="space-y-2">
              {projects.slice(0, 5).map(p => (
                <Link key={p.id} to={`/projects/${p.id}`}>
                  <div className="flex items-center justify-between p-2 rounded-md hover:bg-primary/5 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {p.dataset_columns ? `${p.dataset_columns} columns` : 'No data'} · {p.status}
                      </p>
                    </div>
                    <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0 ml-2" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </GlowCard>

        {/* Recent Deployments */}
        <GlowCard>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Server className="w-4 h-4 text-accent" />
              Active Deployments
            </h3>
            <Link to="/model-comparison-deployed" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {activeDeployments.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No active deployments</p>
          ) : (
            <div className="space-y-2">
              {activeDeployments.slice(0, 5).map(d => (
                <div key={d.id} className="flex items-center justify-between p-2 rounded-md hover:bg-accent/5 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{d.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {d.model_name} · {d.total_calls || 0} calls
                    </p>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent flex-shrink-0 ml-2">
                    active
                  </span>
                </div>
              ))}
            </div>
          )}
        </GlowCard>
      </div>
    </div>
  );
}