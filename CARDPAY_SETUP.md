# CardPay readiness — DETEKTOR

CardPay is implemented but intentionally disabled until merchant onboarding is complete.

Required Supabase Edge secrets:
- `CARDPAY_ENABLED=true`
- `CARDPAY_MID=<merchant id>`
- `CARDPAY_HMAC_KEY_HEX=<128 hex chars / 64-byte security key>`
- `CARDPAY_APP_RETURN_URL=<public account/payment result URL>`
- optional `CARDPAY_GATEWAY_URL` (defaults to the official CardPay endpoint)

Runtime:
1. Authenticated customer chooses a Detektory top-up.
2. `cardpay-checkout` creates a server-side order and signs the CardPay request.
3. Browser POSTs the signed fields to CardPay.
4. CardPay returns to `cardpay-return`.
5. The return handler verifies HMAC and ECDSA using Tatra banka's current public-key list.
6. Only a verified `RES=OK` finalizes the order and grants Detektory, idempotently.

Before launch:
- activate only final rows in `detektor_credit_products`;
- set the Edge secrets above;
- run Tatra banka sandbox/acceptance tests;
- keep TEST purchase UI disabled/removed in production.

No merchant key is stored in GitHub or browser code.
