/**
 * Gitdocify — Monitoring Dashboard Component
 *
 * A React component to display system monitoring information.
 */

import { useState, useEffect } from 'react';

interface SystemMetrics {
  cpu: number;
  memory: number;
  uptime: string;
  jobQueue: number;
  activeUsers: number;
  users: number;
  repositories: number;
  codeChunks: number;
  jobs: number;
  lastUpdate: string;
}

export default function MonitoringDashboard() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch system metrics
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/metrics');
        const data = await response.json();
        setMetrics(data.stats);
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div>Loading monitoring data...</div>;
  }

  if (!metrics) {
    return <div>Failed to load monitoring data</div>;
  }

  return (
    <div className="monitoring-dashboard">
      <h2>System Monitoring</h2>
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Active Users</h3>
          <p className="metric-value">{metrics.users}</p>
        </div>
        <div className="metric-card">
          <h3>Repositories</h3>
          <p className="metric-value">{metrics.repositories}</p>
        </div>
        <div className="metric-card">
          <h3>Code Chunks</h3>
          <p className="metric-value">{metrics.codeChunks}</p>
        </div>
        <div className="metric-card">
          <h3>Jobs in Queue</h3>
          <p className="metric-value">{metrics.jobs}</p>
        </div>
      </div>
    </div>
  );
}