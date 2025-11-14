# Optimistic Oracle Resolution System - How Winners Are Picked

## Table of Contents
1. [Overview](#overview)
2. [How It Works: Step-by-Step](#how-it-works-step-by-step)
3. [The Three-Phase Process](#the-three-phase-process)
4. [Complete Flow Diagrams](#complete-flow-diagrams)
5. [Smart Contract Functions](#smart-contract-functions)
6. [Bond System & Economics](#bond-system--economics)
7. [Outcome Types](#outcome-types)
8. [Time Constraints](#time-constraints)
9. [Example Scenarios](#example-scenarios)
10. [Code Examples](#code-examples)
11. [Frontend Integration](#frontend-integration)
12. [Security & Incentives](#security--incentives)

---

## Overview

The **Optimistic Oracle** is a decentralized resolution system inspired by UMA Protocol. Instead of relying on a single trusted oracle, it uses a **challenge-based system** where:

1. **Anyone can propose** a resolution (winner)
2. **Anyone can dispute** a proposal if they disagree
3. **If undisputed** after a waiting period, the proposal becomes final
4. **If disputed**, the dispute invalidates the proposal and a new one can be made

**Key Philosophy**: "Innocent until proven guilty" - proposals are accepted unless someone disputes them within the dispute period.

---

## How It Works: Step-by-Step

### Phase 1: Market Ends & Resolution Window Opens

```
Market Timeline:
├─ Market Created (block 100)
├─ Trading Period (blocks 100-1000)
├─ End Time Reached (block 1000) ← Trading stops
├─ Resolution Time Reached (block 1200) ← Proposals can start
└─ Dispute Period (1 day = ~7200 blocks)
```

**Requirements for Resolution**:
- `block.timestamp >= market.resolutionTime` ✅
- Market is still `active` ✅
- Market is not already `resolved` ✅

### Phase 2: Propose Resolution

**Who Can Propose**: **Anyone** (no admin required)

**What They Propose**: One of three outcomes:
- `1` = YES won
- `2` = NO won  
- `3` = INVALID (market was invalid/cancelled)

**Cost**: Must pay `proposerBondAmount` (default: **0.01 ETH**)

**Process**:

```javascript
// Example: Someone proposes YES won
await contract.proposeResolution(
  marketId,
  1, // YES
  { value: ethers.utils.parseEther("0.01") } // Bond payment
);
```

**What Happens**:
1. ✅ Validates market is ready for resolution
2. ✅ Checks no existing active proposal (or previous was finalized/disputed)
3. ✅ Takes bond payment (ETH locked in contract)
4. ✅ Creates `ResolutionProposal` struct
5. ✅ Emits `ResolutionProposed` event
6. ✅ Starts **dispute period** countdown (1 day default)

**Proposal Struct Created**:
```solidity
ResolutionProposal {
    proposedOutcome: 1,           // YES
    proposer: 0xABC...,          // Proposer's wallet
    proposalTime: block.timestamp, // When proposed
    proposerBond: 0.01 ether,      // Bond amount
    disputed: false,              // Not disputed yet
    disputer: address(0),          // No disputer
    disputeTime: 0,               // Not disputed
    disputerBond: 0,              // No dispute bond
    finalized: false              // Not finalized yet
}
```

### Phase 3: Dispute Window (Critical Period)

**Duration**: `disputePeriod` (default: **1 day**)

**Who Can Dispute**: **Anyone** who disagrees with the proposal

**Cost**: Must pay `proposerBond × disputerBondMultiplier` (default: **0.01 ETH × 2 = 0.02 ETH**)

**Why Dispute**:
- Proposer said "YES won" but you know "NO won"
- Proposer said "NO won" but you know "YES won"
- Proposer said "YES won" but market should be "INVALID"

**Process**:

```javascript
// Someone disagrees and disputes
await contract.disputeResolution(
  marketId,
  { value: ethers.utils.parseEther("0.02") } // 2x proposer bond
);
```

**What Happens When Disputed**:
1. ✅ Validates proposal exists and is not finalized
2. ✅ Checks dispute period hasn't expired
3. ✅ Validates dispute bond is sufficient (2x proposer bond)
4. ✅ Marks proposal as `disputed = true`
5. ✅ **Returns proposer's bond** (proposer loses bond, gets it back)
6. ✅ Records disputer's info and bond
7. ✅ **Deletes the proposal** (clears it for new proposal)
8. ✅ Emits `ResolutionDisputed` event

**Important**: When disputed, the proposal is **invalidated** and deleted. A new proposal can be made.

**Proposal After Dispute**:
```solidity
ResolutionProposal {
    proposedOutcome: 0,  // Cleared
    proposer: address(0), // Cleared
    // ... all cleared
    disputed: true,      // Marked as disputed
    disputer: 0xXYZ...,  // Disputer's address
    // Proposal is DELETED - new one can be made
}
```

### Phase 4: Finalize Resolution

**When**: After dispute period expires **AND** proposal was **not disputed**

**Who Can Finalize**: **Anyone** (anyone can trigger finalization)

**Cost**: **Free** (no payment required)

**Process**:

```javascript
// After 1 day, if undisputed, anyone can finalize
await contract.finalizeResolution(marketId);
```

**What Happens**:
1. ✅ Validates proposal exists
2. ✅ Validates proposal is **not disputed**
3. ✅ Validates proposal is **not already finalized**
4. ✅ Validates dispute period has expired
5. ✅ Validates market is not already resolved
6. ✅ Sets `market.resolved = true`
7. ✅ Sets `market.outcome = proposal.proposedOutcome`
8. ✅ Sets `market.active = false`
9. ✅ Returns proposer's bond as **reward** (correct resolution!)
10. ✅ Removes market from `activeMarkets` list
11. ✅ Emits `ResolutionFinalized` event
12. ✅ Emits `MarketResolved` event

**Final Market State**:
```solidity
Market {
    resolved: true,
    outcome: 1,        // YES won (from proposal)
    active: false,     // Market closed
    // ... other fields
}

ResolutionProposal {
    finalized: true,    // Finalized
    // ... other fields
}
```

### Phase 5: Claim Winnings

After resolution, users with winning shares can claim:

```javascript
await contract.claimWinnings(marketId);
```

**Payout Logic**:
- If `outcome == 1` (YES won) → Users with YES shares get payout
- If `outcome == 2` (NO won) → Users with NO shares get payout
- If `outcome == 3` (INVALID) → All users get proportional refund

---

## The Three-Phase Process

```
┌─────────────────────────────────────────────────────────┐
│ PHASE 1: PROPOSE                                         │
│                                                          │
│  Timeline: Market resolutionTime reached                │
│  Action: Anyone can propose outcome (YES/NO/INVALID)   │
│  Cost: proposerBondAmount (0.01 ETH)                   │
│  Result: Proposal created, dispute period starts        │
│                                                          │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ PHASE 2: CHALLENGE (Optional)                            │
│                                                          │
│  Timeline: Within disputePeriod (1 day)                 │
│  Action: Anyone can dispute if they disagree            │
│  Cost: proposerBond × 2 (0.02 ETH)                      │
│  Result: If disputed → proposal deleted, start over      │
│          If not disputed → proceed to Phase 3           │
│                                                          │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ PHASE 3: FINALIZE                                        │
│                                                          │
│  Timeline: After disputePeriod expires (1 day passed)   │
│  Action: Anyone can finalize (if not disputed)         │
│  Cost: Free                                              │
│  Result: Market resolved, winner announced              │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Complete Flow Diagrams

### Flow 1: Successful Resolution (No Dispute)

```
Time: T0 (Market resolutionTime reached)
│
├─ User A proposes: "YES won" + pays 0.01 ETH bond
│  ├─ Proposal created
│  ├─ Dispute period starts (1 day)
│  └─ Event: ResolutionProposed
│
Time: T1 (After 1 day)
│
├─ Nobody disputed
│  ├─ Dispute period expired
│  └─ Proposal still valid
│
Time: T2 (Anyone calls finalizeResolution)
│
├─ User B calls finalizeResolution() (free)
│  ├─ Market resolved: outcome = YES
│  ├─ Market closed (active = false)
│  ├─ Proposer gets bond back (reward)
│  └─ Event: ResolutionFinalized
│
Time: T3 (Users claim winnings)
│
├─ Users with YES shares call claimWinnings()
│  └─ They receive ETH payout
│
✅ Winner: YES
```

### Flow 2: Disputed Resolution (Proposal Rejected)

```
Time: T0 (Market resolutionTime reached)
│
├─ User A proposes: "YES won" + pays 0.01 ETH bond
│  ├─ Proposal created
│  ├─ Dispute period starts (1 day)
│  └─ Event: ResolutionProposed
│
Time: T1 (Within dispute period, e.g., 12 hours later)
│
├─ User B disagrees → disputes proposal
│  ├─ Pays 0.02 ETH (2x bond)
│  ├─ Proposal marked as disputed
│  ├─ Proposal DELETED (cleared)
│  ├─ User A's bond returned (they lost)
│  └─ Event: ResolutionDisputed
│
Time: T2 (After dispute, immediately)
│
├─ User C proposes NEW resolution: "NO won" + pays 0.01 ETH
│  ├─ New proposal created
│  ├─ New dispute period starts (1 day)
│  └─ Event: ResolutionProposed
│
Time: T3 (After 1 day)
│
├─ Nobody disputes this time
│  └─ Dispute period expired
│
Time: T4 (Anyone calls finalizeResolution)
│
├─ User D calls finalizeResolution() (free)
│  ├─ Market resolved: outcome = NO
│  ├─ Market closed
│  ├─ Proposer (User C) gets bond back (reward)
│  └─ Event: ResolutionFinalized
│
✅ Winner: NO (First proposal was wrong, second was right)
```

### Flow 3: Multiple Disputes (Multiple Rounds)

```
Time: T0
├─ User A: Proposes "YES" + 0.01 ETH bond
│
Time: T1 (6 hours later)
├─ User B: Disputes + 0.02 ETH bond
│  ├─ Proposal deleted
│  └─ User A gets 0.01 ETH back
│
Time: T2 (Immediately after)
├─ User C: Proposes "NO" + 0.01 ETH bond
│
Time: T3 (8 hours later)
├─ User D: Disputes + 0.02 ETH bond
│  ├─ Proposal deleted
│  └─ User C gets 0.01 ETH back
│
Time: T4 (Immediately after)
├─ User E: Proposes "YES" + 0.01 ETH bond
│
Time: T5 (After full 1 day)
├─ Nobody disputes
│  └─ Dispute period expired
│
Time: T6
├─ User F: Finalizes resolution
│  ├─ Market resolved: outcome = YES
│  └─ User E gets 0.01 ETH bond back (reward)
│
✅ Winner: YES (After two disputes, third proposal succeeded)
```

---

## Smart Contract Functions

### 1. `proposeResolution(uint256 _marketId, uint8 _proposedOutcome)`

**Purpose**: Propose a resolution (winner) for a market

**Parameters**:
- `_marketId`: Market ID to resolve
- `_proposedOutcome`: `1` (YES), `2` (NO), or `3` (INVALID)

**Payment**: Must send `proposerBondAmount` (default: 0.01 ETH)

**Requirements**:
- ✅ Market is active
- ✅ Market is not already resolved
- ✅ `block.timestamp >= market.resolutionTime` (resolution window open)
- ✅ Outcome is valid (1, 2, or 3)
- ✅ No existing active proposal (or previous was finalized/disputed)

**What It Does**:
```solidity
function proposeResolution(uint256 _marketId, uint8 _proposedOutcome) 
    external 
    payable 
    nonReentrant 
{
    // 1. Validate market state
    require(market.active, "Market not active");
    require(!market.resolved, "Market already resolved");
    require(_proposedOutcome >= 1 && _proposedOutcome <= 3, "Invalid outcome");
    require(block.timestamp >= market.resolutionTime, "Market not ready");
    require(msg.value >= proposerBondAmount, "Insufficient bond");
    
    // 2. Check no conflicting proposal
    require(proposal.proposer == address(0) || proposal.finalized, 
            "Proposal already exists");
    
    // 3. Clear if previous was disputed
    if (proposal.disputed) {
        delete resolutionProposals[_marketId];
    }
    
    // 4. Create new proposal
    proposal.proposedOutcome = _proposedOutcome;
    proposal.proposer = msg.sender;
    proposal.proposalTime = block.timestamp;
    proposal.proposerBond = msg.value;
    proposal.disputed = false;
    proposal.finalized = false;
    
    emit ResolutionProposed(...);
}
```

**Event**: `ResolutionProposed(uint256 indexed marketId, address indexed proposer, uint8 proposedOutcome, uint256 proposalTime, uint256 bond)`

---

### 2. `disputeResolution(uint256 _marketId)`

**Purpose**: Dispute a proposed resolution

**Parameters**:
- `_marketId`: Market ID with proposal to dispute

**Payment**: Must send `proposerBond × disputerBondMultiplier` (default: 0.01 ETH × 2 = 0.02 ETH)

**Requirements**:
- ✅ Proposal exists
- ✅ Proposal not already disputed
- ✅ Proposal not already finalized
- ✅ `block.timestamp < proposalTime + disputePeriod` (dispute period hasn't expired)

**What It Does**:
```solidity
function disputeResolution(uint256 _marketId) 
    external 
    payable 
    nonReentrant 
{
    // 1. Validate proposal exists
    require(proposal.proposer != address(0), "No proposal exists");
    require(!proposal.disputed, "Already disputed");
    require(!proposal.finalized, "Already finalized");
    require(block.timestamp < proposal.proposalTime + disputePeriod, 
            "Dispute period expired");
    
    // 2. Validate dispute bond
    uint256 requiredBond = proposal.proposerBond * disputerBondMultiplier;
    require(msg.value >= requiredBond, "Insufficient dispute bond");
    
    // 3. Mark as disputed
    proposal.disputed = true;
    proposal.disputer = msg.sender;
    proposal.disputeTime = block.timestamp;
    proposal.disputerBond = msg.value;
    
    // 4. Return proposer's bond (they lost)
    payable(proposal.proposer).transfer(proposal.proposerBond);
    proposal.proposerBond = 0;
    
    // 5. Clear proposal to allow new one
    delete resolutionProposals[_marketId];
    
    emit ResolutionDisputed(...);
}
```

**Important**: 
- Proposer's bond is **returned** (they lose the challenge)
- Proposal is **deleted** (allows new proposal)
- Disputer's bond stays in contract (not returned)

**Event**: `ResolutionDisputed(uint256 indexed marketId, address indexed disputer, uint256 disputeTime, uint256 bond)`

---

### 3. `finalizeResolution(uint256 _marketId)`

**Purpose**: Finalize a resolution after dispute period expires

**Parameters**:
- `_marketId`: Market ID to finalize

**Payment**: **Free** (no payment required)

**Requirements**:
- ✅ Proposal exists
- ✅ Proposal is **not disputed**
- ✅ Proposal is **not already finalized**
- ✅ `block.timestamp >= proposalTime + disputePeriod` (dispute period expired)
- ✅ Market is not already resolved

**What It Does**:
```solidity
function finalizeResolution(uint256 _marketId) 
    external 
    nonReentrant 
{
    // 1. Validate proposal
    require(proposal.proposer != address(0), "No proposal exists");
    require(!proposal.disputed, "Proposal was disputed");
    require(!proposal.finalized, "Already finalized");
    require(block.timestamp >= proposal.proposalTime + disputePeriod, 
            "Dispute period not expired");
    require(!market.resolved, "Market already resolved");
    
    // 2. Finalize resolution
    proposal.finalized = true;
    market.resolved = true;
    market.outcome = proposal.proposedOutcome; // Set winner!
    market.active = false;
    
    // 3. Reward proposer (return bond + they get it back)
    payable(proposal.proposer).transfer(proposal.proposerBond);
    
    // 4. Remove from active markets
    // ... remove from activeMarketIds array
    
    emit ResolutionFinalized(...);
    emit MarketResolved(...);
}
```

**Important**: 
- Proposer's bond is **returned as reward** (correct resolution!)
- Market is **closed** (no more trading)
- Winner is **officially announced**

**Event**: 
- `ResolutionFinalized(uint256 indexed marketId, uint8 finalOutcome, address indexed finalizer)`
- `MarketResolved(uint256 indexed marketId, uint8 outcome, uint256 totalPayout)`

---

### 4. `getResolutionProposal(uint256 _marketId)`

**Purpose**: View function to get proposal details

**Returns**:
```solidity
(
    uint8 proposedOutcome,      // 1=YES, 2=NO, 3=INVALID
    address proposer,            // Who proposed
    uint256 proposalTime,        // When proposed
    uint256 proposerBond,        // Bond amount
    bool disputed,               // Was it disputed?
    address disputer,            // Who disputed (if any)
    uint256 disputeTime,         // When disputed (if any)
    bool finalized,              // Is it finalized?
    uint256 timeUntilFinalizable // Seconds until can finalize (0 if ready)
)
```

---

## Bond System & Economics

### Bond Amounts

| Role | Bond Amount | Default |
|------|-------------|---------|
| **Proposer** | `proposerBondAmount` | 0.01 ETH |
| **Disputer** | `proposerBond × disputerBondMultiplier` | 0.01 ETH × 2 = 0.02 ETH |

### Bond Flow

#### Scenario 1: Proposal Not Disputed (Success)

```
Proposer pays:    0.01 ETH → Contract
Dispute period:    1 day
Nobody disputes:   ✅
Finalize:          Anyone calls finalizeResolution()
Proposer gets:     0.01 ETH back (reward) ✅
Net profit:       0 ETH (bond returned, no profit/loss)
```

#### Scenario 2: Proposal Disputed (Failure)

```
Proposer pays:    0.01 ETH → Contract
Disputer pays:     0.02 ETH → Contract
Proposer gets:     0.01 ETH back (immediately) ✅
Disputer keeps:    0.02 ETH locked (not returned)
Proposal:         DELETED ❌
New proposal:     Can be made
Net for proposer: 0 ETH (bond returned, but proposal rejected)
Net for disputer: -0.02 ETH (bond locked, not returned)
```

### Economic Incentives

**Why Propose**:
- If correct → Bond returned (no loss)
- If wrong → Bond returned if disputed, but time wasted
- If wrong and not disputed → Market resolves incorrectly (bad for platform)

**Why Dispute**:
- If proposer is wrong → You prevent incorrect resolution
- Cost: 2x bond (0.02 ETH) that is NOT returned
- Risk: If proposer was right, you lose 0.02 ETH

**Why Finalize**:
- If you proposed and it's not disputed → You get bond back
- If someone else proposed → You help resolve market (no cost, no reward)
- Anyone can finalize (free action)

---

## Outcome Types

### Outcome = 1: YES Won

**Meaning**: The market question's "YES" outcome is correct.

**Example**: 
- Market: "Will Bitcoin reach $100k by 2024?"
- Outcome: `1` (YES) = Bitcoin DID reach $100k

**Winners**: Users with YES shares can claim winnings

### Outcome = 2: NO Won

**Meaning**: The market question's "NO" outcome is correct.

**Example**:
- Market: "Will Bitcoin reach $100k by 2024?"
- Outcome: `2` (NO) = Bitcoin did NOT reach $100k

**Winners**: Users with NO shares can claim winnings

### Outcome = 3: INVALID

**Meaning**: The market was invalid, unclear, or should be cancelled.

**Example**:
- Market: "Will Company X merge with Company Y?"
- Outcome: `3` (INVALID) = Merger was blocked by regulators, market invalid

**Winners**: All users get proportional refunds based on their investment

---

## Time Constraints

### Critical Timelines

```
Market Created
    │
    ├─ Trading Period (endTime)
    │
    ├─ Resolution Time (resolutionTime) ← Proposals can START
    │
    ├─ Proposal Made
    │   │
    │   ├─ Dispute Window Opens (proposalTime)
    │   │
    │   ├─ Dispute Period (1 day)
    │   │
    │   └─ Can Dispute Until (proposalTime + disputePeriod)
    │
    └─ After Dispute Period Expires
        │
        └─ Can Finalize (proposalTime + disputePeriod <= block.timestamp)
```

### Time Validations

**To Propose**:
- `block.timestamp >= market.resolutionTime` ✅

**To Dispute**:
- `block.timestamp < proposal.proposalTime + disputePeriod` ✅
  (Must dispute within dispute period)

**To Finalize**:
- `block.timestamp >= proposal.proposalTime + disputePeriod` ✅
  (Must wait for dispute period to expire)

---

## Example Scenarios

### Example 1: Simple Resolution (No Dispute)

**Market**: "Will Ethereum reach $5000 by Dec 31, 2024?"

**Timeline**:
1. **Dec 31, 2024 23:59** → Market ends (trading stops)
2. **Jan 7, 2025 23:59** → Resolution time reached
3. **Jan 7, 2025 23:59** → Alice checks price, Ethereum is at $5100
4. **Jan 7, 2025 23:59** → Alice proposes: `outcome = 1` (YES) + pays 0.01 ETH bond
5. **Jan 8, 2025 00:00** → Dispute period starts (1 day)
6. **Jan 8, 2025 23:59** → Dispute period expires (nobody disputed)
7. **Jan 9, 2025 00:00** → Bob calls `finalizeResolution()` (free)
8. **Jan 9, 2025 00:00** → Market resolved: `outcome = 1` (YES won)
9. **Jan 9, 2025 00:00** → Alice gets 0.01 ETH bond back (reward)
10. **Jan 9, 2025 00:01+** → Users with YES shares call `claimWinnings()`

**Result**: ✅ YES won (Ethereum did reach $5000)

---

### Example 2: Disputed Resolution (Wrong Proposal)

**Market**: "Will Company X IPO in Q1 2024?"

**Timeline**:
1. **Apr 1, 2024** → Resolution time reached
2. **Apr 1, 2024 10:00** → Alice proposes: `outcome = 1` (YES) + pays 0.01 ETH
   - She saw a news article claiming IPO happened
3. **Apr 1, 2024 14:00** → Bob checks official sources, no IPO happened
4. **Apr 1, 2024 14:00** → Bob disputes + pays 0.02 ETH
   - Alice's bond returned (0.01 ETH)
   - Proposal deleted
5. **Apr 1, 2024 14:01** → Charlie proposes: `outcome = 2` (NO) + pays 0.01 ETH
6. **Apr 2, 2024 14:01** → Dispute period expires (nobody disputes)
7. **Apr 2, 2024 14:02** → David calls `finalizeResolution()`
8. **Apr 2, 2024 14:02** → Market resolved: `outcome = 2` (NO won)
9. **Apr 2, 2024 14:02** → Charlie gets 0.01 ETH bond back (reward)

**Result**: ✅ NO won (IPO didn't happen, Alice was wrong, Charlie was right)

---

### Example 3: INVALID Outcome

**Market**: "Will Company A acquire Company B by June 2024?"

**Timeline**:
1. **Jul 1, 2024** → Resolution time reached
2. **Jul 1, 2024 10:00** → Alice proposes: `outcome = 1` (YES) + pays 0.01 ETH
   - She saw acquisition announced
3. **Jul 1, 2024 12:00** → Bob checks: Acquisition was BLOCKED by regulators
4. **Jul 1, 2024 12:00** → Bob disputes + pays 0.02 ETH
5. **Jul 1, 2024 12:01** → Charlie proposes: `outcome = 3` (INVALID) + pays 0.01 ETH
   - Market should be invalid because acquisition blocked
6. **Jul 2, 2024 12:01** → Dispute period expires (nobody disputes)
7. **Jul 2, 2024 12:02** → David calls `finalizeResolution()`
8. **Jul 2, 2024 12:02** → Market resolved: `outcome = 3` (INVALID)
9. **Jul 2, 2024 12:02** → All users get proportional refunds

**Result**: ✅ INVALID (Acquisition blocked, market cancelled)

---

## Code Examples

### Example 1: Propose Resolution (Frontend)

```javascript
// In a React component
const handleProposeResolution = async () => {
  try {
    const proposerBond = await contracts.predictionMarket.proposerBondAmount();
    const bondEth = ethers.utils.formatEther(proposerBond);
    
    console.log(`Proposing resolution with bond: ${bondEth} ETH`);
    
    // Propose YES won
    const tx = await contracts.predictionMarket.proposeResolution(
      marketId,
      1, // YES
      {
        value: proposerBond, // Send bond
        gasLimit: 500000
      }
    );
    
    await tx.wait();
    
    console.log('✅ Resolution proposed!');
    toast.success('Resolution proposed! Dispute period: 1 day');
    
    // Refresh proposal data
    await fetchResolutionProposal();
  } catch (error) {
    console.error('Error proposing resolution:', error);
    toast.error(error.message);
  }
};
```

### Example 2: Dispute Resolution

```javascript
const handleDisputeResolution = async () => {
  try {
    // Get proposal to calculate dispute bond
    const proposal = await contracts.predictionMarket.getResolutionProposal(marketId);
    const proposerBond = proposal.proposerBond;
    const disputePeriod = await contracts.predictionMarket.disputePeriod();
    const disputerBondMultiplier = await contracts.predictionMarket.disputerBondMultiplier();
    
    // Calculate required dispute bond
    const requiredDisputeBond = proposerBond.mul(disputerBondMultiplier);
    const bondEth = ethers.utils.formatEther(requiredDisputeBond);
    
    console.log(`Disputing with bond: ${bondEth} ETH`);
    
    // Check if still in dispute period
    const currentTime = Math.floor(Date.now() / 1000);
    const disputeDeadline = proposal.proposalTime.toNumber() + disputePeriod.toNumber();
    
    if (currentTime >= disputeDeadline) {
      toast.error('Dispute period has expired');
      return;
    }
    
    // Dispute the proposal
    const tx = await contracts.predictionMarket.disputeResolution(
      marketId,
      {
        value: requiredDisputeBond,
        gasLimit: 500000
      }
    );
    
    await tx.wait();
    
    console.log('✅ Resolution disputed!');
    toast.success('Resolution disputed! Proposal deleted, new proposal can be made.');
    
    // Refresh proposal data (should be cleared now)
    await fetchResolutionProposal();
  } catch (error) {
    console.error('Error disputing resolution:', error);
    toast.error(error.message);
  }
};
```

### Example 3: Finalize Resolution

```javascript
const handleFinalizeResolution = async () => {
  try {
    const proposal = await contracts.predictionMarket.getResolutionProposal(marketId);
    
    // Check if can finalize
    if (proposal.disputed) {
      toast.error('Proposal was disputed, cannot finalize');
      return;
    }
    
    if (proposal.finalized) {
      toast.error('Resolution already finalized');
      return;
    }
    
    const timeUntilFinalizable = proposal.timeUntilFinalizable.toNumber();
    if (timeUntilFinalizable > 0) {
      toast.error(`Please wait ${Math.ceil(timeUntilFinalizable / 3600)} hours`);
      return;
    }
    
    // Finalize (no payment required)
    const tx = await contracts.predictionMarket.finalizeResolution(
      marketId,
      {
        gasLimit: 500000
      }
    );
    
    await tx.wait();
    
    console.log('✅ Resolution finalized!');
    toast.success('Market resolved! Winner announced.');
    
    // Refresh market data
    await fetchMarketData();
  } catch (error) {
    console.error('Error finalizing resolution:', error);
    toast.error(error.message);
  }
};
```

### Example 4: Check Proposal Status

```javascript
const fetchResolutionProposal = async () => {
  try {
    const proposal = await contracts.predictionMarket.getResolutionProposal(marketId);
    
    const proposalData = {
      proposedOutcome: proposal.proposedOutcome.toNumber(), // 1, 2, or 3
      proposer: proposal.proposer,
      proposalTime: proposal.proposalTime.toNumber(), // Unix timestamp
      proposerBond: ethers.utils.formatEther(proposal.proposerBond), // ETH
      disputed: proposal.disputed,
      disputer: proposal.disputer,
      disputeTime: proposal.disputeTime.toNumber(),
      finalized: proposal.finalized,
      timeUntilFinalizable: proposal.timeUntilFinalizable.toNumber() // Seconds
    };
    
    // Convert outcome to readable
    const outcomeMap = {
      1: 'YES',
      2: 'NO',
      3: 'INVALID'
    };
    
    console.log('Proposal Status:', {
      outcome: outcomeMap[proposalData.proposedOutcome],
      proposer: proposalData.proposer,
      disputed: proposalData.disputed ? 'Yes' : 'No',
      finalized: proposalData.finalized ? 'Yes' : 'No',
      timeUntilFinalizable: proposalData.timeUntilFinalizable > 0 
        ? `${Math.ceil(proposalData.timeUntilFinalizable / 3600)} hours`
        : 'Ready to finalize'
    });
    
    return proposalData;
  } catch (error) {
    console.error('Error fetching proposal:', error);
    return null;
  }
};
```

---

## Frontend Integration

### UI Components Needed

1. **Propose Resolution Button**
   - Shows when: `block.timestamp >= market.resolutionTime` AND no active proposal
   - Displays: Required bond amount
   - Allows: Selecting outcome (YES/NO/INVALID)

2. **Dispute Button**
   - Shows when: Proposal exists AND not disputed AND within dispute period
   - Displays: Required dispute bond (2x proposer bond)
   - Warning: Bond not returned if you dispute

3. **Finalize Button**
   - Shows when: Proposal exists AND not disputed AND dispute period expired
   - Free action (no payment)

4. **Proposal Status Display**
   - Shows: Proposed outcome, proposer, time until finalizable
   - Updates: Real-time countdown
   - Events: Listen to `ResolutionProposed`, `ResolutionDisputed`, `ResolutionFinalized`

### Example React Component

```jsx
const ResolutionPanel = ({ marketId, market }) => {
  const { contracts } = useWeb3();
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const fetchProposal = async () => {
      if (!contracts?.predictionMarket || !marketId) return;
      
      try {
        const prop = await contracts.predictionMarket.getResolutionProposal(marketId);
        setProposal({
          proposedOutcome: prop.proposedOutcome.toNumber(),
          proposer: prop.proposer,
          proposalTime: prop.proposalTime.toNumber(),
          proposerBond: ethers.utils.formatEther(prop.proposerBond),
          disputed: prop.disputed,
          finalized: prop.finalized,
          timeUntilFinalizable: prop.timeUntilFinalizable.toNumber()
        });
      } catch (error) {
        console.error('Error fetching proposal:', error);
      }
    };
    
    fetchProposal();
    const interval = setInterval(fetchProposal, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [contracts, marketId]);
  
  const canPropose = market.resolutionTime <= Math.floor(Date.now() / 1000) 
    && !market.resolved 
    && (!proposal || proposal.finalized);
  
  const canDispute = proposal 
    && !proposal.disputed 
    && !proposal.finalized
    && proposal.timeUntilFinalizable > 0;
  
  const canFinalize = proposal 
    && !proposal.disputed 
    && !proposal.finalized
    && proposal.timeUntilFinalizable === 0;
  
  return (
    <div className="resolution-panel">
      <h3>Resolution Status</h3>
      
      {!proposal && canPropose && (
        <ProposeResolutionForm marketId={marketId} />
      )}
      
      {proposal && (
        <div className="proposal-status">
          <p>Proposed: {proposal.proposedOutcome === 1 ? 'YES' : proposal.proposedOutcome === 2 ? 'NO' : 'INVALID'}</p>
          <p>Proposer: {proposal.proposer}</p>
          <p>Bond: {proposal.proposerBond} ETH</p>
          
          {proposal.disputed && (
            <div className="disputed">
              ⚠️ This proposal was disputed and removed
            </div>
          )}
          
          {proposal.finalized && (
            <div className="finalized">
              ✅ Resolution finalized! Winner: {proposal.proposedOutcome === 1 ? 'YES' : 'NO'}
            </div>
          )}
          
          {canDispute && (
            <button onClick={handleDispute}>
              Dispute (Cost: {parseFloat(proposal.proposerBond) * 2} ETH)
            </button>
          )}
          
          {canFinalize && (
            <button onClick={handleFinalize}>
              Finalize Resolution (Free)
            </button>
          )}
        </div>
      )}
    </div>
  );
};
```

---

## Security & Incentives

### Security Features

1. **Bond Requirements**
   - Proposers must stake ETH (prevents spam)
   - Disputers must stake 2x bond (prevents frivolous disputes)

2. **Time Lock**
   - Dispute period gives time to challenge
   - Cannot finalize until dispute period expires

3. **Challenge Mechanism**
   - Anyone can dispute wrong proposals
   - Disputed proposals are deleted (prevents bad resolutions)

4. **Economic Incentives**
   - Correct proposers get bond back
   - Wrong proposers lose nothing if disputed (bond returned)
   - Disputers risk losing bond if wrong

### Attack Vectors & Mitigations

**Attack 1: Spam Proposals**
- **Vector**: Create many proposals with small bonds
- **Mitigation**: Bond required (0.01 ETH makes spam expensive)

**Attack 2: Censorship**
- **Vector**: Dispute all correct proposals
- **Mitigation**: Disputing costs 2x bond (0.02 ETH), not returned

**Attack 3: Finalization Delay**
- **Vector**: Nobody finalizes, market stuck
- **Mitigation**: Anyone can finalize (free action, no cost)

**Attack 4: Wrong Resolution (No Dispute)**
- **Vector**: Propose wrong outcome, nobody disputes
- **Mitigation**: Economic incentive to dispute (prevent bad resolution)
- **Reality**: Community monitors and disputes incorrect proposals

---

## Summary

### Key Points

1. **Anyone can propose** a resolution (no admin required)
2. **Anyone can dispute** if they disagree (within 1 day)
3. **If undisputed**, proposal becomes final after dispute period
4. **If disputed**, proposal is deleted and new one can be made
5. **Bonds** incentivize correct proposals and prevent spam
6. **Free to finalize** - anyone can trigger finalization

### Resolution Flow

```
Propose → Wait (1 day) → Finalize
    ↓
If Disputed → Delete → New Proposal
```

### Outcomes

- `1` = YES won → YES shareholders win
- `2` = NO won → NO shareholders win  
- `3` = INVALID → Everyone gets proportional refund

### Default Settings

- **Proposer Bond**: 0.01 ETH
- **Disputer Bond**: 0.02 ETH (2x proposer)
- **Dispute Period**: 1 day
- **Configurable**: Admin can change these via `setProposerBondAmount()`, `setDisputePeriod()`, `setDisputerBondMultiplier()`

---

**End of Documentation**

