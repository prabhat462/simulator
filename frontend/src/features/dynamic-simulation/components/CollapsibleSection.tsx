/**
 * CollapsibleSection — reusable wrapper with collapse/expand toggle.
 * Enhanced UX with smooth CSS max-height transition animation.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface Props {
    title: string;
    icon?: string;
    defaultCollapsed?: boolean;
    badge?: string | number;
    children: React.ReactNode;
}

export default function CollapsibleSection({ title, icon, defaultCollapsed = false, badge, children }: Props) {
    const [collapsed, setCollapsed] = useState(defaultCollapsed);
    const contentRef = useRef<HTMLDivElement>(null);
    const [maxH, setMaxH] = useState<string>(defaultCollapsed ? '0px' : '2000px');

    useEffect(() => {
        const el = contentRef.current;
        if (!el) return;
        if (collapsed) {
            // First set to current scrollHeight so transition has a start value
            setMaxH(`${el.scrollHeight}px`);
            // Force reflow then animate to 0
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setMaxH('0px');
                });
            });
        } else {
            setMaxH(`${el.scrollHeight}px`);
            const timer = setTimeout(() => setMaxH('none'), 350);
            return () => clearTimeout(timer);
        }
    }, [collapsed]);

    const toggle = useCallback(() => setCollapsed(c => !c), []);

    return (
        <div className={`collapsible-section ${collapsed ? 'collapsed' : 'expanded'}`}>
            <button
                className="collapsible-header"
                onClick={toggle}
                type="button"
                title={`Click to ${collapsed ? 'expand' : 'collapse'}`}
            >
                <span className="collapsible-title">
                    {icon && <span className="collapsible-icon">{icon}</span>}
                    {title}
                    {badge !== undefined && <span className="collapsible-badge">{badge}</span>}
                </span>
                <span className={`collapsible-chevron ${collapsed ? 'chevron-right' : 'chevron-down'}`}>
                    ▸
                </span>
            </button>
            <div
                className="collapsible-content"
                ref={contentRef}
                style={{ maxHeight: maxH, overflow: 'hidden' }}
            >
                {children}
            </div>
        </div>
    );
}
