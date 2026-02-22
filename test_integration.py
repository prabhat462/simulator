#!/usr/bin/env python3
"""
Integration test: Run simulation with HybridEnsemble and other algorithms.
Tests end-to-end workflow with real data.
"""

import pandas as pd
from engine.plugin_loader import load_algorithms
from engine.simulation import SimulationEngine

def test_simulation_with_hybrid():
    """Run a simulation including the HybridEnsemble algorithm."""
    
    print("=" * 80)
    print("Integration Test: Simulation with HybridEnsemble")
    print("=" * 80)
    
    # Load algorithms from plugins.yaml
    print("\n✓ Loading algorithms from plugins.yaml...")
    algorithms = load_algorithms()
    
    print(f"  Available algorithms: {list(algorithms.keys())}")
    assert 'hybrid_ensemble' in algorithms, "HybridEnsemble not registered!"
    print("  ✓ HybridEnsemble found in registry")
    
    # Load test data
    print("\n✓ Loading test data...")
    df = pd.read_csv('data/test_data/before_transactions.csv')
    
    # Extract necessary features
    df['timestamp'] = pd.to_datetime(df['date'])
    df['hour'] = df['timestamp'].dt.hour
    df['day_of_week'] = df['timestamp'].dt.dayofweek
    
    # Sort by timestamp
    df = df.sort_values('timestamp').reset_index(drop=True)
    
    print(f"  Loaded {len(df)} transactions")
    print(f"  Date range: {df['timestamp'].min()} to {df['timestamp'].max()}")
    print(f"  Gateways: {sorted(df['payment_gateway'].unique())}")
    
    # Create algorithm instances with default configs
    print("\n✓ Instantiating algorithms...")
    algorithm_instances = {}
    
    for algo_id, algo_cls in algorithms.items():
        algo = algo_cls()
        gateways = sorted(df['payment_gateway'].unique().tolist())
        algo.initialize(gateways, {})  # Use defaults
        algorithm_instances[algo_id] = algo
        print(f"  - {algo_id}: {algo_cls.metadata()['name']}")
    
    # Run simulation
    print("\n✓ Running simulation on first 1000 transactions...")
    
    def progress_callback(progress):
        if progress.processed % 500 == 0:
            print(f"  Progress: {progress.percent}% ({progress.processed}/{progress.total_transactions})")
    
    engine = SimulationEngine()
    run_id = "test_hybrid_001"
    
    # Use only first 1000 transactions for quick test
    df_sample = df.iloc[:1000].copy()
    
    results = engine.run_simulation(
        run_id=run_id,
        df=df_sample,
        algorithm_instances=algorithm_instances,
        counterfactual_mode='sr_interpolation',
        warm_up_transactions=100,
        random_seed=42,
        progress_callback=progress_callback,
    )
    
    print(f"\n✓ Simulation completed!")
    print(f"  Status: {engine.runs[run_id]['status']}")
    
    # Display results
    print("\n✓ Results Summary:")
    print(f"  {'Algorithm':<25} {'Success Rate':<15} {'Regret':<15}")
    print("  " + "-" * 55)
    
    for algo_id, result in results.items():
        sr = result.overall_sr
        regret = result.cumulative_regret if hasattr(result, 'cumulative_regret') else 0
        meta = algorithms[algo_id].metadata()
        algo_name = meta.get('short_name', algo_id)
        print(f"  {algo_name:<25} {sr:<15.4f} {regret:<15.2f}")
    
    # Verify hybrid comes from correct class
    hybrid_result = results.get('hybrid_ensemble')
    assert hybrid_result is not None, "HybridEnsemble result missing!"
    print(f"\n✓ HybridEnsemble performance: SR={hybrid_result.overall_sr:.4f}")
    
    print("\n" + "=" * 80)
    print("Integration test PASSED!")
    print("=" * 80)

if __name__ == '__main__':
    test_simulation_with_hybrid()
