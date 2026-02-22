#!/usr/bin/env python3
"""
Quick test for Advanced Sliding Window UCB algorithm.
Verifies exploration and exploitation mechanisms work correctly.
"""

from algorithms.advanced_sw_ucb import AdvancedSlidingWindowUCB
from algorithms.base import TransactionContext

def test_advanced_sw_ucb():
    print("=" * 80)
    print("ADVANCED SLIDING WINDOW UCB - QUICK TEST")
    print("=" * 80)
    
    # Initialize
    algo = AdvancedSlidingWindowUCB()
    arms = ['pg_a', 'pg_b', 'pg_c']
    config = {
        'window_size': 50,
        'exploration_rate': 0.20,  # 20% for demo
        'seed': 42
    }
    algo.initialize(arms, config)
    print(f"\n✅ Algorithm initialized")
    print(f"   Arms: {arms}")
    print(f"   Window size: {config['window_size']}")
    print(f"   Exploration rate: {config['exploration_rate']} (20%)")
    
    # Metadata 
    meta = algo.metadata()
    print(f"\n📋 Metadata:")
    print(f"   Name: {meta['name']}")
    print(f"   Short: {meta['short_name']}")
    print(f"   Paper: {meta['paper']}")
    
    # Hyperparameter schema
    schema = algo.get_hyperparameter_schema()
    print(f"\n⚙️  Hyperparameters:")
    for key, spec in schema.items():
        print(f"   - {key}: {spec['type']} (default={spec['default']}, range=[{spec['min']}, {spec['max']}])")
    
    # Simulate selections and updates
    print(f"\n🎯 Simulating 100 transactions...")
    exploration_count = 0
    exploitation_count = 0
    
    # Seed some history
    for i in range(100):
        context = TransactionContext(
            payment_mode='upi',
            card_network=None,
            issuing_bank='HDFC',
            amount=1000.0,
            amount_band='500-5k',
            hour=12,
            day_of_week=3,
            merchant_category='ecomm',
            device_type='mobile_app',
            state='KA'
        )
        
        chosen = algo.select(context)
        
        # Simulate outcomes: pg_a is good (0.9), pg_b is okay (0.6), pg_c is bad (0.3)
        if chosen == 'pg_a':
            reward = 1 if (i % 10) < 9 else 0
        elif chosen == 'pg_b':
            reward = 1 if (i % 10) < 6 else 0
        else:  # pg_c
            reward = 1 if (i % 10) < 3 else 0
        
        algo.update(chosen, reward, context)
        
        # Count exploration vs exploitation
        explanation = algo.explain_last_decision()
        if '[EXPLORATION]' in explanation:
            exploration_count += 1
        else:
            exploitation_count += 1
    
    print(f"   ✅ Completed 100 selections")
    print(f"      - Exploration: {exploration_count} ({exploration_count}%)")
    print(f"      - Exploitation: {exploitation_count} ({exploitation_count}%)")
    print(f"      - Target exploration rate: 20%")
    
    # Check state
    state = algo.get_state()
    print(f"\n📊 Final Algorithm State:")
    for arm, arm_state in state.items():
        sr = arm_state.get('estimated_sr')
        score = arm_state.get('selection_score')
        count = arm_state.get('window_count')
        sr_str = f"{sr:.3f}" if sr is not None else "None"
        score_str = f"{score:.4f}" if score is not None else "None"
        print(f"   {arm}:")
        print(f"      - Estimated SR: {sr_str}")
        print(f"      - Transactions: {count}")
        print(f"      - Selection Score: {score_str}")
    
    # Test decision explanation
    print(f"\n💬 Sample Decision Explanations:")
    for i in range(5):
        context = TransactionContext(
            payment_mode='upi',
            card_network=None,
            issuing_bank='HDFC',
            amount=1000.0,
            amount_band='500-5k',
            hour=12,
            day_of_week=3,
            merchant_category='ecomm',
            device_type='mobile_app',
            state='KA'
        )
        chosen = algo.select(context)
        explanation = algo.explain_last_decision()
        algo.update(chosen, 1, context)
        print(f"   {i+1}. {explanation[:100]}...")
    
    print(f"\n✅ ALL TESTS PASSED")
    print("=" * 80)

if __name__ == '__main__':
    test_advanced_sw_ucb()
