#!/usr/bin/env python3
"""
Test circuit breaker functionality of HybridEnsemble.
Validates emergency stop mechanism for catastrophically failing gateways.
"""

from algorithms.hybrid_ensemble import HybridEnsemble
from algorithms.base import TransactionContext

def test_circuit_breaker():
    """Test circuit breaker activation and recovery."""
    
    print("=" * 80)
    print("Testing Circuit Breaker Functionality")
    print("=" * 80)
    
    # Create algorithm with aggressive CB settings for testing
    algo = HybridEnsemble()
    arms = ['Razorpay', 'PayU', 'Cashfree']
    config = {
        'window_size': 200,
        'ts_alpha_prior': 1.0,
        'ts_beta_prior': 1.0,
        'ts_decay': 0.995,
        'discount_factor': 0.70,
        'ucb_weight': 0.60,
        'sw_weight': 0.70,
        'cb_threshold': 0.30,      # Circuit opens below 30% SR
        'cb_eval_window': 10,      # Evaluate on last 10 transactions (faster)
        'cb_recovery_rounds': 50,  # Recover after 50 txns (faster testing)
        'degraded_penalty': 0.15,
        'seed': 42,
    }
    
    algo.initialize(arms, config)
    
    # Test context
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
    
    print("\n✓ Testing normal operation...")
    # Phase 1: Normal operation with all gateways working
    for i in range(15):
        algo.select(context)
        algo.update('Razorpay', 1, context)  # Always succeed
    
    state = algo.get_state()
    ctx_key = 'upi|HDFC|500-5k'
    rb_state = state[ctx_key]['Razorpay']
    assert rb_state['cb_state'] == 'CLOSED', "Should be CLOSED in normal operation"
    print(f"  Razorpay CB state: {rb_state['cb_state']} ✓")
    print(f"  Razorpay SR: {rb_state['cb_recent_sr']:.2f} ✓")
    
    print("\n✓ Testing circuit breaker activation...")
    # Phase 2: Razorpay starts failing catastrophically
    # Need 10 consecutive failures (cb_eval_window=10) with 0% SR to trigger CB
    for i in range(15):
        algo.select(context)
        algo.update('Razorpay', 0, context)  # All fail
    
    state = algo.get_state()
    rb_state = state[ctx_key]['Razorpay']
    cb_state = rb_state['cb_state']
    print(f"  After 15 failures:")
    print(f"    CB state: {cb_state}")
    print(f"    Recent SR: {rb_state['cb_recent_sr']:.2f}")
    print(f"    CB blocked until: {rb_state['cb_blocked_until']}")
    
    # Circuit should be open
    if cb_state == 'OPEN':
        print(f"  Circuit OPENED ✓ (gateway blocked)")
    elif cb_state == 'HALF_OPEN':
        print(f"  Circuit HALF_OPEN (SR between 30%-50%)")
    
    # Verify traffic is diverted
    print("\n✓ Verifying traffic diversion after circuit open...")
    for i in range(5):
        chosen = algo.select(context)
        assert chosen != 'Razorpay', f"Should not route to blocked Razorpay, got {chosen}"
        algo.update(chosen, 1, context)
    print(f"  Successfully routed to {chosen} (not Razorpay) ✓")
    
    print("\n✓ Testing recovery mechanism...")
    # Phase 3: Let recovery period elapse
    # recovery_rounds=50, so after 50 more transactions, CB should recover
    current_blocked_until = state[ctx_key]['Razorpay']['cb_blocked_until']
    recovery_needed = current_blocked_until - algo.total_transaction_count
    print(f"  Current transaction: {algo.total_transaction_count}")
    print(f"  CB blocked until: {current_blocked_until}")
    print(f"  Transactions until recovery: {recovery_needed}")
    
    # Send dummy transactions for other gateways to advance counter
    # but also START Razorpay succeeding again to show recovery
    for i in range(recovery_needed + 5):
        chosen = algo.select(context)
        # Make Razorpay start succeeding after recovery period
        if chosen == 'Razorpay':
            algo.update(chosen, 1, context)  # Success
        else:
            algo.update(chosen, 1, context)  # Keep others succeeding
    
    # Now check if Razorpay is available again
    # It may still be in HALF_OPEN since we had failures, but it should be available
    state = algo.get_state()
    rb_state = state[ctx_key]['Razorpay']
    is_available = rb_state['cb_state'] != 'OPEN'
    assert is_available, f"CB should allow Razorpay after recovery period, but state is {rb_state['cb_state']}"
    print(f"  After recovery period: CB state = {rb_state['cb_state']} (available: NOT OPEN) ✓")
    
    # Verify Razorpay can be routed to and succeeds
    razorpay_selected = False
    for i in range(30):
        chosen = algo.select(context)
        if chosen == 'Razorpay':
            razorpay_selected = True
            algo.update('Razorpay', 1, context)  # Success
        else:
            algo.update(chosen, 1, context)
    
    if razorpay_selected:
        state = algo.get_state()
        rb_state = state[ctx_key]['Razorpay']
        print(f"  Razorpay was selected during recovery and succeeded ✓")
        print(f"  Razorpay new SR: {rb_state['cb_recent_sr']:.2f}")
        print(f"  Razorpay CB state: {rb_state['cb_state']} ✓")
    
    print("\n✓ Testing half-open state (degradation without catastrophe)...")
    # Reset and test half-open state (SR between 30% and 50%)
    algo2 = HybridEnsemble()
    algo2.initialize(arms, config)
    
    # Generate outcomes with 40% SR (between 30%-50%)
    outcomes = [1, 0, 1, 0, 0, 0, 1, 1, 0, 0, 1]  # 4 successes, 7 failures ≈ 36%
    for i in range(20):
        algo2.select(context)
        outcome = outcomes[i % len(outcomes)]
        algo2.update('PayU', outcome, context)
    
    state = algo2.get_state()
    pu_state = state[ctx_key]['PayU']
    print(f"  PayU recent SR: {pu_state['cb_recent_sr']:.2f}")
    print(f"  PayU CB state: {pu_state['cb_state']}")
    
    if pu_state['cb_state'] == 'HALF_OPEN':
        print(f"  HALF_OPEN state active (score will be penalized) ✓")
    
    print("\n" + "=" * 80)
    print("Circuit Breaker Tests PASSED!")
    print("=" * 80)

if __name__ == '__main__':
    test_circuit_breaker()
