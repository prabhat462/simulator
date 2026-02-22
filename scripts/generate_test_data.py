"""
Generate realistic before/after transaction CSV test data
for the Algorithm Impact Analysis Dashboard.
"""
import csv, random, os
from datetime import datetime, timedelta

random.seed(42)

GATEWAYS = ['Razorpay', 'PayU', 'Cashfree', 'PhonePe_PG', 'CCAvenue']
MODES = ['UPI', 'Credit Card', 'Debit Card', 'Net Banking', 'Wallet']
CARD_NETWORKS = ['Visa', 'Mastercard', 'RuPay', 'Amex', None]
BANKS = ['HDFC Bank', 'SBI', 'ICICI Bank', 'Axis Bank', 'Kotak Bank',
         'PNB', 'Bank of Baroda', 'IndusInd Bank', 'Yes Bank', 'Federal Bank']
MERCHANTS = [
    ('M001', 'Flipkart', 'E-commerce'), ('M002', 'Amazon India', 'E-commerce'),
    ('M003', 'Swiggy', 'Food Delivery'), ('M004', 'Zomato', 'Food Delivery'),
    ('M005', 'BookMyShow', 'Entertainment'), ('M006', 'MakeMyTrip', 'Travel'),
    ('M007', 'BigBasket', 'Grocery'), ('M008', 'Myntra', 'Fashion'),
    ('M009', 'PharmEasy', 'Healthcare'), ('M010', 'UrbanClap', 'Services'),
    ('M011', 'Jio Mart', 'E-commerce'), ('M012', 'Nykaa', 'Beauty'),
    ('M013', 'Cred', 'Fintech'), ('M014', 'Dream11', 'Gaming'),
    ('M015', 'Ola', 'Transport'),
]
FAILURE_CATS = ['Bank Declined', 'Timeout', 'Insufficient Funds',
                'Authentication Failed', 'Network Error', 'Card Blocked',
                'Invalid CVV', 'Fraud Suspected']

GW_SR_BEFORE = {'Razorpay': 0.88, 'PayU': 0.82, 'Cashfree': 0.85, 'PhonePe_PG': 0.80, 'CCAvenue': 0.78}
GW_SR_AFTER  = {'Razorpay': 0.91, 'PayU': 0.86, 'Cashfree': 0.89, 'PhonePe_PG': 0.87, 'CCAvenue': 0.83}
GW_SHARE_BEFORE = {'Razorpay': 0.22, 'PayU': 0.22, 'Cashfree': 0.20, 'PhonePe_PG': 0.18, 'CCAvenue': 0.18}
GW_SHARE_AFTER  = {'Razorpay': 0.30, 'PayU': 0.18, 'Cashfree': 0.25, 'PhonePe_PG': 0.17, 'CCAvenue': 0.10}

# Configuration for constrained simulation
FIXED_MODE = None        # Set to 'UPI', 'Credit Card', etc. to restrict
FIXED_MERCHANT_ID = None # Set to 'M001', 'M002', etc. to restrict

HOUR_WEIGHTS = [1,1,1,1,1,2,3,5,7,8,9,10,10,9,8,7,7,8,9,10,8,5,3,2]

def generate(num, start, end, period, gw_sr, gw_share):
    rows = []
    days = (end - start).days + 1
    gws = list(gw_share.keys())
    wts = [gw_share[g] for g in gws]
    for i in range(num):
        date = start + timedelta(days=random.randint(0, days - 1))
        hour = random.choices(range(24), weights=HOUR_WEIGHTS)[0]
        ts = date.replace(hour=hour, minute=random.randint(0,59), second=random.randint(0,59))
        gw = random.choices(gws, weights=wts)[0]
        
        # Apply constraints
        mode = FIXED_MODE if FIXED_MODE else random.choice(MODES)
        
        if FIXED_MERCHANT_ID:
            # Find the specific merchant tuple
            merchant_tuple = next((m for m in MERCHANTS if m[0] == FIXED_MERCHANT_ID), None)
            if merchant_tuple:
                mid, mn, mc = merchant_tuple
            else:
                mid, mn, mc = random.choice(MERCHANTS) # Fallback if ID not found
        else:
            mid, mn, mc = random.choice(MERCHANTS)

        cn = random.choice(CARD_NETWORKS) if mode in ('Credit Card','Debit Card') else None
        bank = random.choice(BANKS)
        # mid, mn, mc are set above
        amt = float(round(float(random.uniform(50, 50000)), 2))
        sr = min(0.99, max(0.5, gw_sr[gw] + {'UPI':0.03,'Credit Card':0.01,'Debit Card':-0.01,'Net Banking':-0.03,'Wallet':0.02}.get(mode,0) + random.uniform(-0.03,0.03)))
        ok = random.random() < sr
        rows.append({
            'transaction_id': f'TXN_{period.upper()}_{i:07d}',
            'date': ts.strftime('%Y-%m-%d %H:%M:%S'),
            'payment_gateway': gw, 'payment_mode': mode,
            'card_network': cn or '', 'issuing_bank': bank,
            'amount': amt, 'outcome': 1 if ok else 0,
            'failure_category': '' if ok else random.choice(FAILURE_CATS),
            'latency_ms': int(random.uniform(200,800) if ok else random.uniform(500,3000)),
            'merchant_id': mid, 'merchant_name': mn, 'merchant_category': mc,
        })
    return rows

def write_csv(rows, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=rows[0].keys())
        w.writeheader()
        w.writerows(rows)
    print(f'  {len(rows)} rows -> {path}')

if __name__ == '__main__':
    print('Generating test data...')
    before = generate(50000, datetime(2025,1,1), datetime(2025,1,15), 'before', GW_SR_BEFORE, GW_SHARE_BEFORE)
    write_csv(before, 'data/test_data/before_transactions.csv')
    after = generate(50000, datetime(2025,1,16), datetime(2025,1,31), 'after', GW_SR_AFTER, GW_SHARE_AFTER)
    write_csv(after, 'data/test_data/after_transactions.csv')
    bsr = float(sum(int(r['outcome']) for r in before)) / len(before) if before else 0.0
    asr = float(sum(int(r['outcome']) for r in after)) / len(after) if after else 0.0
    print(f'\nBaseline SR: {bsr*100:.2f}%  |  Algo SR: {asr*100:.2f}%  |  Uplift: {(asr-bsr)*100:+.2f}pp')
    print('Upload these files via the Impact Analysis dashboard!')
