# Inflate Firestore Security Specification

## Collections & Ownership Model
All application state is partitioned into four top-level collections ("tables"), each owned strictly by the authenticated Google user via `ownerId == request.auth.uid`:

1. `/cars/{carDocId}`
   - Stores vehicle profiles (`slk250`, `fortuner`), target cold pressures (`recommendedKpa`), `defaultSizes`, and `renewals` (`insurance`, `cartax`).
   - Owner can read, create, update (`renewals`, `updatedAt`, `recommendedKpa`, `defaultSizes`, `displayTitle`, `trim`), and delete their own car documents.
   - `ownerId`, `carKey`, and `createdAt` are immutable once created.

2. `/pressureLogs/{logId}`
   - Stores tyre pressure top-up entries (`date`, `pressures`, optional `beforePressures`, `station`, `note`, `lowTyre`).
   - Create requires valid parent `/cars/{carDocId}` owned by `request.auth.uid`.
   - Owner can read, update, and delete only their own records; `ownerId`, `carId`, `carDocId`, `createdAt` are immutable.

3. `/purchaseLogs/{purchaseId}`
   - Stores tyre purchase history (`date`, `vendor`, `brandModel`, `tyreSize`, `corners`, `totalCost`, optional `notes`).
   - Create requires valid parent `/cars/{carDocId}` owned by `request.auth.uid`.
   - Owner can read, update, and delete only their own records; `ownerId`, `carId`, `carDocId`, `createdAt` are immutable.

4. `/contacts/{contactId}`
   - Stores tyre shop contacts (`company`, optional `website`, `phone`, `notes`).
   - Owner can read, create, update, and delete only their own records; `ownerId` and `createdAt` are immutable.

## Security Invariants
- Default deny (`allow read, write: if false;`) on all unmatched paths.
- Authenticated + verified Google email required (`request.auth != null && request.auth.token.email_verified == true`).
- Strict field allowlists (`hasAll`, `hasOnly`) and type/size bounds on all strings, numbers, maps, and lists.
- Server timestamp enforcement (`createdAt == request.time`, `updatedAt == request.time`).
- Safe list queries scoped by `where('ownerId', '==', request.auth.uid)` with `resource.data.ownerId == request.auth.uid` (zero `get()` calls during `list`).
