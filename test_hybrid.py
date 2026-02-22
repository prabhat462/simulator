#!/usr/bin/env python3
"""
Quick test script for HybridEnsemble algorithm.
Validates initialization, selection, and update mechanisms.
"""

from algorithms.hybrid_ensemble import HybridEnsemble
from algorithms.base import TransactionContext

def test_hybrid_ensemble():
    """Test basic functionality of HybridEnsemble."""
    
    print("=" * 80)
    print("Testing HybridEnsemble Algorithm")
    print("=" * 80)
    
    # Create algorithm instance
    algo = HybridEnsemble()
    arms = ['Razorpay', 'PayU', 'Cashfree', 'Stripe']
    config = {
        'window_size': 200,
        'ts_alpha_prior': 1.0,
        'ts_beta_prior': 1.0,
        'ts_decay': 0.995,
        'discount_factor': 0.70,
        'ucb_weight': 0.60,
        'sw_weight': 0.70,
        'cb_threshold': 0.30,
        'cb_eval_window': 20,
        'cb_recovery_rounds': 200,
        'degraded_penalty': 0.15,
        'seed': 42,
    }
    
    algo.initialize(arms, config)
    print("\n✓ Algorithm initialized successfully")
    print(f"  Arms: {arms}")
    print(f"  Config: {config}")
    
    # Test metadata
    metadata = algo.metadata()
    print("\n✓ Metadata retrieved:")
    for key, value in metadata.items():
        print(f"  {key}: {value}")
    
    # Create a test transaction context
    context = TransactionContext(
        payment_mode='upi',
        card_network=None,
        issuing_bank='HDFC',
        amount=1000.0,
        amount_band='500-5k',
        hour=14,
        day_of_week=2,
        merchant_category='ecomm',
        device_type='mobile_app',
        state='MH',
    )
    print("\n✓ Test context created:")
    print(f"  Mode: {context.payment_mode}, Bank: {context.issuing_bank}, Amount: {context.amount}")
    
    # Simulate 50 transactions
    print("\n✓ Simulating 50 transactions:")
    outcomes = [1, 1, 0, 1, 1, 1, 0, 1, 1, 1] * 5  # 10 per gateway
    
    for i, outcome in enumerate(outcomes):
        # Select gateway
        chosen = algo.select(context)
        
        # Record outcome
        algo.update(chosen, outcome, context)
        
        if (i + 1) % 10 == 0:
            print(f"  Transaction {i+1}: Chose '{chosen}', Outcome={outcome}")
    
    # Get final state
    state = algo.get_state()
    print("\n✓ Final algorithm state:")
    
    # Show state for the UPI|HDFC|500-5k context
    context_key = 'upi|HDFC|500-5k'
    if context_key in state:
        context_state = state[context_key]
        for arm, arm_data in context_state.items():
            print(f"\n  {arm}:")
            print(f"    SW-UCB SR: {arm_data.get('sw_window_sr')}")
            print(f"    TS Posterior Mean: {arm_data.get('ts_posterior_mean')}")
            print(f"    D-UCB SR: {arm_data.get('disc_sr')}")
            print(f"    Circuit State: {arm_data.get('cb_state')}")
    
    # Get explanation
    explanation = algo.explain_last_decision()
    print("\n✓ Last decision explanation:")
    print(explanation)
    
    # Get hyperparameter schema
    schema = algo.get_hyperparameter_schema()
    print(f"\n✓ Hyperparameter schema has {len(schema)} parameters")
    
    print("\n" + "=" * 80)
    print("All tests passed!")
    print("=" * 80)

if __name__ == '__main__':
    test_hybrid_ensemble()
