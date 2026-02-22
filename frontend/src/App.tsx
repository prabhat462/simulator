import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import ExperimentSetup from './screens/ExperimentSetup';
import LiveDashboard from './screens/LiveDashboard';
import ResultsExplorer from './screens/ResultsExplorer';
import TransparencyPanel from './screens/TransparencyPanel';
import ReportCenter from './screens/ReportCenter';
import ImpactLayout from './screens/impact/ImpactLayout';
import ImpactDataUpload from './screens/impact/ImpactDataUpload';
import ImpactAnalysisConfig from './screens/impact/ImpactAnalysisConfig';
import ExecutiveSummary from './screens/impact/ExecutiveSummary';
import GlobalAnalysis from './screens/impact/GlobalAnalysis';
import GatewayAnalysis from './screens/impact/GatewayAnalysis';
import ModeAnalysis from './screens/impact/ModeAnalysis';
import BankAnalysis from './screens/impact/BankAnalysis';
import MerchantAnalysis from './screens/impact/MerchantAnalysis';
import TemporalAnalysis from './screens/impact/TemporalAnalysis';
import FailureAnalysis from './screens/impact/FailureAnalysis';
import SimulationSandbox from './features/dynamic-simulation/SimulationSandbox';
import StatisticianDashboard from './features/dynamic-simulation/panels/StatisticianDashboard';
import './index.css';

function App() {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    return (
        <BrowserRouter>
            <div className="app-layout">
                {/* Sidebar */}
                <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
                    <div className="sidebar-header">
                        <div className="sidebar-logo">
                            <div className="sidebar-logo-icon">PG</div>
                            <div className="sidebar-logo-text">
                                <span className="sidebar-logo-title">PG Router</span>
                                <span className="sidebar-logo-subtitle">Algorithm Simulator</span>
                            </div>
                        </div>
                    </div>

                    <nav className="sidebar-nav">
                        <div className="nav-section-label">Simulation</div>
                        <NavLink to="/setup" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                            <span className="nav-icon">⚡</span>
                            Experiment Setup
                        </NavLink>
                        <NavLink to="/live" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                            <span className="nav-icon">📡</span>
                            Live Dashboard
                        </NavLink>

                        <div className="nav-section-label">Analysis</div>
                        <NavLink to="/results" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                            <span className="nav-icon">📊</span>
                            Results Explorer
                        </NavLink>
                        <NavLink to="/transparency" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                            <span className="nav-icon">🔍</span>
                            Transparency Panel
                        </NavLink>
                        <NavLink to="/report" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                            <span className="nav-icon">📄</span>
                            Report Center
                        </NavLink>

                        <div className="nav-section-label">Impact Analysis</div>
                        <NavLink to="/impact" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                            <span className="nav-icon">📈</span>
                            Algo Impact Dashboard
                        </NavLink>

                        <div className="nav-section-label">Dynamic Simulation</div>
                        <NavLink to="/sandbox" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                            <span className="nav-icon">🧪</span>
                            Dynamic Sandbox
                        </NavLink>
                        <NavLink to="/sandbox/analysis" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                            <span className="nav-icon">📊</span>
                            Statistician Dashboard
                        </NavLink>
                    </nav>

                    <button
                        className="sidebar-collapse-btn"
                        onClick={() => setSidebarCollapsed(c => !c)}
                        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        {sidebarCollapsed ? '▶' : '◀'}
                    </button>
                </aside>

                {/* Main Content */}
                <main className="main-content" style={{ marginLeft: sidebarCollapsed ? 48 : 260 }}>
                    <Routes>
                        <Route path="/" element={<Navigate to="/setup" replace />} />
                        <Route path="/setup" element={<ExperimentSetup />} />
                        <Route path="/live" element={<LiveDashboard />} />
                        <Route path="/live/:runId" element={<LiveDashboard />} />
                        <Route path="/results" element={<ResultsExplorer />} />
                        <Route path="/results/:runId" element={<ResultsExplorer />} />
                        <Route path="/transparency" element={<TransparencyPanel />} />
                        <Route path="/transparency/:runId" element={<TransparencyPanel />} />
                        <Route path="/report" element={<ReportCenter />} />
                        <Route path="/report/:runId" element={<ReportCenter />} />
                        <Route path="/impact" element={<ImpactLayout />}>
                            <Route index element={<ImpactDataUpload />} />
                            <Route path="config" element={<ImpactAnalysisConfig />} />
                            <Route path="summary" element={<ExecutiveSummary />} />
                            <Route path="global" element={<GlobalAnalysis />} />
                            <Route path="gateways" element={<GatewayAnalysis />} />
                            <Route path="modes" element={<ModeAnalysis />} />
                            <Route path="banks" element={<BankAnalysis />} />
                            <Route path="merchants" element={<MerchantAnalysis />} />
                            <Route path="temporal" element={<TemporalAnalysis />} />
                            <Route path="failures" element={<FailureAnalysis />} />
                        </Route>
                        <Route path="/sandbox" element={<SimulationSandbox />} />
                        <Route path="/sandbox/analysis" element={<StatisticianDashboard />} />
                    </Routes>
                </main>
            </div>
        </BrowserRouter>
    );
}

export default App;
