import { NavLink, Outlet, useLocation } from 'react-router-dom';

const impactNavItems = [
    { to: '/impact', label: 'Data Upload', icon: '📤', exact: true },
    { to: '/impact/config', label: 'Analysis Config', icon: '⚙️' },
    { to: '/impact/summary', label: 'Executive Summary', icon: '📊' },
    { to: '/impact/global', label: 'Global Analysis', icon: '🌐' },
    { to: '/impact/gateways', label: 'Gateway Analysis', icon: '🏦' },
    { to: '/impact/modes', label: 'Payment Modes', icon: '💳' },
    { to: '/impact/banks', label: 'Bank Analysis', icon: '🏛️' },
    { to: '/impact/merchants', label: 'Merchant Analysis', icon: '🏪' },
    { to: '/impact/temporal', label: 'Temporal Analysis', icon: '⏰' },
    { to: '/impact/failures', label: 'Failure Analysis', icon: '❌' },
];

export default function ImpactLayout() {
    const location = useLocation();

    return (
        <div className="impact-layout">
            <nav className="impact-subnav">
                <div className="impact-subnav-header">
                    <span className="impact-subnav-icon">📈</span>
                    <span className="impact-subnav-title">Impact Analysis</span>
                </div>
                <div className="impact-subnav-links">
                    {impactNavItems.map(item => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === '/impact'}
                            className={({ isActive }) => `impact-nav-link ${isActive ? 'active' : ''}`}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            {item.label}
                        </NavLink>
                    ))}
                </div>
            </nav>
            <div className="impact-main">
                <Outlet />
            </div>
        </div>
    );
}
