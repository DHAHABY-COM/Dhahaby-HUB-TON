# Dhahaby Backend (Express)

## Run
- Install: `npm install`
- API server: `node index.js`
- Transactions migration: `npm run migrate:transactions`
- Transactions email OTP migration: `npm run migrate:transactions:otp`
- NFT worker (manual): `npm run worker:nft-issuance`
- NFT worker AVAX (manual): `npm run worker:nft-issuance:avax`

## PM2
- Start API: `pm2 start index.js --name dhahaby-api`
- Start NFT worker: `pm2 start npm --name dhahaby-nft-worker -- run worker:nft-issuance`
- Start AVAX NFT worker: `pm2 start npm --name dhahaby-nft-worker-avax -- run worker:nft-issuance:avax`
- Save process list: `pm2 save`
- Enable startup: `pm2 startup`

## Key Env Vars (NFT + Pricing)
- `NFT_ISSUANCE_PRIVATE_KEY`
- `NFT_ISSUANCE_CONTRACT_ADDRESS`
- `NFT_ISSUANCE_RPC_URL` (optional; defaults to chain RPC)
- `AVAX_CCHAIN_RPC_URL`
- `AVAX_PRIVATE_KEY`
- `AVAX_VALUATION_REGISTRY_ADDRESS`
- `AVAX_NFT_ISSUANCE_RPC_URL`
- `NFT_ISSUANCE_PRIVATE_KEY_AVAX`
- `NFT_ISSUANCE_CONTRACT_ADDRESS_AVAX`
- `AVAX_NFT_CONTRACT_ADDRESS`
- `NFT_ISSUANCE_MINT_METHODS` (optional)
- `IG_FALLBACK_BASE_URL`
- `IG_STALE_*`
- `GOLDAPI_BASE_URL`
- `GOLDAPI_ACCESS_TOKEN`

## Recent Backend Updates (2026-02-22)
- Added admin overview endpoints for waitlist, users, valuations, organizations, and NFT issuances with search/filter/pagination support.
- Added safer NFT issuance behavior: minted rows are immutable, retries create new rows for failed/cancelled states.
- Fixed duplicate NFT issuance rows in admin list responses.
- Improved verified jeweller metadata parsing for legacy/new JSON payload formats.
- Hardened `/api/XAU/{currency}` with IG -> cache -> GoldAPI fallback flow and off-market handling.

## API Notes

### Auth model
- `Public`: no auth required.
- `Appraiser`: `Authorization: Bearer <firebase-id-token>` and mapped appraiser profile/org required.
- `Admin`: same bearer token, and token email must be allow-listed in `APPRAISER_ADMIN_EMAILS`.

### Common pagination
- Most admin overview endpoints support: `page`, `page_size` (or `limit` alias), plus endpoint-specific sort/filter params.

### Public
| Method | Endpoint | Query | Purpose |
|---|---|---|---|
| `GET` | `/api/XAU/:currency` | `currency`: `USD`,`AED`,`GBP`,`EUR`,`INR` | XAU quote with IG primary, stale cache fallback, then GoldAPI hydration fallback. |
| `POST` | `/api/loan/apply-bnb` | `multipart/form-data`: `walletAddress`, `valuation`, `image` | Creates prevaluation and writes valuation hash to opBNB valuation contract. |
| `POST` | `/api/loan/apply-avax` | `multipart/form-data`: `walletAddress`, `valuation`, `image` | Creates prevaluation and writes valuation hash to AVAX C-Chain valuation contract. |
| `POST` | `/api/loan/schedule` | Body: `prevaluationId`, `appraisalData` | Schedules appraisal and records appraisal-fee transaction when payment payload exists. |
| `GET` | `/api/transactions` | Query: `page`,`page_size`,`type`,`status`,`wallet_address`,`user_id` | Customer transaction history (supports bearer Firebase token user resolution). |
| `POST` | `/api/transactions/request-email-otp` | Body: `email` | Sends one-time code for email-only transaction lookup (rate limited). |
| `POST` | `/api/transactions/lookup-by-email` | Body: `email`,`otp`,`page`,`limit`,`type`,`status` | Verifies OTP and returns transactions for users linked to the email. |

### Appraiser
| Method | Endpoint | Auth | Query/Body | Purpose |
|---|---|---|---|---|
| `GET` | `/api/appraiser/verified-jewellers` | Appraiser/Public-safe | - | Approved jewellers with normalized `metadata_json`. |
| `GET` | `/api/appraiser/bookings` | Appraiser | Query: `status` (csv), `limit` | Organization-scoped bookings + latest NFT issuance snapshot. |
| `POST` | `/api/appraiser/bookings/:bookingId/review` | Appraiser | Body: `review_notes` (required), `review_doc_reference`, `prevaluation_id` | Moves booking to completed and prevaluation to `reviewed`. |
| `POST` | `/api/appraiser/bookings/:bookingId/discard` | Appraiser | Body: `discard_reason` (required), `discard_doc_reference`, `prevaluation_id` | Cancels booking and sets prevaluation to `discarded`. |

### Admin - booking/issuance workflow
| Method | Endpoint | Auth | Query/Body | Purpose |
|---|---|---|---|---|
| `GET` | `/api/appraiser/admin/bookings` | Admin | Query: `status` (`reviewed` default), `sort`, `page`, `limit` | Review queue and post-decision tracking list. |
| `POST` | `/api/appraiser/admin/bookings/:bookingId/decision` | Admin | Body: `prevaluation_id`, `decision` (`discarded`/`converted`), `decision_reason` (required for discarded), `decision_notes`, `issuance_intent` | Final decision on reviewed booking; conversion can enqueue NFT issuance. |
| `POST` | `/api/appraiser/admin/bookings/:bookingId/issuance-metadata` | Admin | - | Generates metadata file/URI and attaches to latest non-minted issuance row. |
| `GET` | `/api/appraiser/admin/nft-issuances` (also `nft-issuance`, `nft_issuances`) | Admin | Query: `status`, `prevaluation_id` | NFT issuance list for operations/debugging. |
| `POST` | `/api/appraiser/admin/nft-issuances/:issuanceId/requeue` (aliases supported) | Admin | - | Requeues `failed`/`cancelled` issuance. |
| `POST` | `/api/appraiser/admin/nft-issuances/:issuanceId/cancel` (aliases supported) | Admin | Body: `reason` | Cancels issuance (except already minted). |

### Admin - overview tabs
| Method | Endpoint | Auth | Query | Purpose |
|---|---|---|---|---|
| `GET` | `/api/appraiser/admin/overview/waitlist` | Admin | `q`, `sort_by`, `sort_order`, `page`, `page_size` | Waitlist grouped by email with latest entry details. |
| `GET` | `/api/appraiser/admin/overview/users` | Admin | `q`, `type` (`all`,`telegram`,`solana`,`bnb`,`avax`), sorting + paging | User explorer with type summary counters. |
| `GET` | `/api/appraiser/admin/overview/valuations` | Admin | `q`, `status`, sorting + paging | Valuations grouped by `user_id` + lifecycle aggregates. |
| `GET` | `/api/appraiser/admin/overview/organizations` | Admin | `q`, `verification_status`, `status`, sorting + paging | Organization KYB/application and lifecycle view. |
| `GET` | `/api/appraiser/admin/overview/nfts` | Admin | `q`, `status`, `chain_key`, `organization_id`, `prevaluation_id`, sorting + paging | Issuance operations view with status summary. |
