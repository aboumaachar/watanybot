# خدني معك — Pooling Feature (KHUDNI WITHAK)

Overview
- Lightweight pooling for riders to share an existing driver trip.
- Riders publish a short ad with pickup location, destination, desired departure window, and seats needed.
- Drivers can opt-in to accept sharers when they confirm a trip.

API surface (frontend hooks)
- POST /api/taxi/publish-pool — publish pool request (pickupText, destinationText?, scheduledAt?, seatsNeeded)
- GET /api/taxi/pools?near={lat,lng}&radius=km — list nearby pools
- POST /api/taxi/pools/{poolId}/join — request to join pool
- Websocket/SSE channel: /api/taxi/pools/subscribe to receive updates when pools near you are created/claimed

UI components
- `PoolComposer` (modal): simple form for pickup (LocationSelector), destination (optional), time window, seats, notes.
- `NearbyPoolsFeed` (card list): shows short list of nearby pools with distance, seats remaining, time, origin/destination.
- `PoolDetails` (dialog): full pool info + join button and messaging link to driver.
- `DriverPoolOffers` (driver dashboard): list of rider join requests; driver can accept/decline.

Data model (frontend)
- Pool: { id, ownerUserId, pickupText, pickupArea: { muhafaza,caza,village }, destinationText?, scheduledAt?, seatsTotal, seatsRemaining, notes, createdAt }
- JoinRequest: { id, poolId, userId, seatsRequested, status }

Behavior notes
- Pools expire after configurable TTL (default 60 minutes).
- Joining requires driver confirmation; until accepted the rider sees "قيد الانتظار".
- Privacy: show partial phone/contact details only after driver accepts request.

Integration points
- Use existing `LocationSelector` for pickup/destination.
- Reuse `api` namespace `createTaxiReservation`/`recordTaxiCallEvent` patterns for endpoint naming and baseUrl injection.

Next steps for implementation
1. Create minimal backend endpoints (stub) to persist pools.
2. Add `PoolComposer` modal and `NearbyPoolsFeed` to taxi commerce page.
3. Add SSE subscription to receive live pool events.
4. Iterate UX after pilot with small user group.

Design owner: product/taxi team
Frontend owner: apps/web-user/features/taxi
Backend owner: apps/gateway-api
