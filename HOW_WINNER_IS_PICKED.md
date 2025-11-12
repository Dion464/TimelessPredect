# How YES/NO Winner is Picked - Simple Explanation

## Quick Answer

The winner (YES or NO) is **proposed by a person** who looks at real-world information, then:
- If **nobody disputes** their proposal within 1 day → That becomes the winner
- If **someone disputes** → The proposal is rejected, and someone else can propose a new winner

**The smart contract doesn't automatically know the answer** - it relies on human judgment + a challenge mechanism.

---

## Step-by-Step: How Winner is Determined

### Step 1: Market Ends (Trading Stops)

```
Market: "Will Bitcoin reach $100k by Dec 31, 2024?"
Dec 31, 2024 → Trading ends
```

### Step 2: Resolution Window Opens

After the `resolutionTime` (e.g., Jan 7, 2025), **anyone can propose the winner**.

### Step 3: Someone Proposes a Winner

**Example**: Alice checks the Bitcoin price on Jan 7, 2025:
- Bitcoin is at **$105,000** ✅
- Alice knows: YES won! (Bitcoin DID reach $100k)
- Alice proposes: `outcome = 1` (YES) + pays 0.01 ETH bond

```javascript
// Alice calls this:
proposeResolution(marketId, 1) // 1 = YES
```

**Important**: Alice is making a **claim** based on what she observed in the real world.

### Step 4: Dispute Window Opens (1 Day)

For the next **24 hours**, anyone can challenge Alice's proposal:

**Scenario A: Nobody Disputes**
```
Alice proposes: YES won
Day 1: No disputes
Day 2: Dispute period expired
Result: YES is the winner ✅
```

**Scenario B: Someone Disputes**
```
Alice proposes: YES won
Bob checks: Actually Bitcoin was at $99,500 (didn't reach $100k)
Bob disputes: Alice is wrong!
Result: 
  - Alice's proposal is DELETED
  - Bob can propose: NO won
```

### Step 5: Finalization

If Alice's proposal was **not disputed**:
- After 1 day, **anyone can finalize** (free action)
- Market resolves to: `outcome = 1` (YES)
- **YES shareholders win** ✅
- Alice gets her 0.01 ETH bond back (reward for correct resolution)

---

## Key Points

### 1. **Human Judgment Required**

The smart contract **doesn't know** what happened in the real world. A person must:
- Check external sources (price websites, news, etc.)
- Verify the outcome
- Propose it to the contract

### 2. **Challenge Mechanism Ensures Correctness**

If someone proposes the **wrong** answer:
- Others can dispute it (costs 0.02 ETH)
- Wrong proposal gets deleted
- Correct person can propose the right answer

### 3. **If Nobody Disputes = Probably Correct**

If a proposal goes undisputed for 1 day, it's likely correct because:
- Many people would dispute if it was wrong
- Disputing only costs 0.02 ETH (small barrier)

### 4. **The Proposer Doesn't "Choose" the Winner**

**Common Misconception**: "The proposer decides the winner"
**Reality**: The proposer makes a **claim** about what happened, and the challenge mechanism validates it.

---

## Real Example: How YES/NO is Determined

### Example: "Will Ethereum reach $5000 by Dec 31, 2024?"

**Dec 31, 2024 11:59 PM** → Market ends

**Jan 7, 2025** → Resolution time reached

**Jan 7, 2025 10:00 AM**:
- Alice checks: Ethereum price = $5,200 ✅
- Alice knows: **YES won** (Ethereum DID reach $5000)
- Alice proposes: `1` (YES) + pays 0.01 ETH

**Jan 7, 2025 10:01 AM - Jan 8, 2025 10:00 AM**:
- **Dispute period** (24 hours)
- Nobody disputes (Alice was correct)

**Jan 8, 2025 10:01 AM**:
- Bob finalizes the resolution (free action)
- Market resolves: `outcome = 1` (YES) ✅
- **YES shareholders can claim winnings**
- NO shareholders get nothing

---

## What If Someone Proposes Wrong Answer?

### Example: Wrong Proposal Gets Disputed

**Market**: "Will Company X IPO in Q1 2024?"

**Apr 1, 2024** → Resolution time

**Apr 1, 2024 10:00 AM**:
- Alice sees fake news article
- Alice proposes: `1` (YES) + pays 0.01 ETH
- **But actually**: IPO didn't happen ❌

**Apr 1, 2024 2:00 PM**:
- Bob checks official sources
- Bob knows: IPO didn't happen → NO won
- Bob disputes Alice's proposal + pays 0.02 ETH
- **Result**: Alice's proposal deleted, bond returned

**Apr 1, 2024 2:01 PM**:
- Charlie proposes: `2` (NO) + pays 0.01 ETH
- **Correct proposal!**

**Apr 2, 2024 2:01 PM**:
- Dispute period expires (nobody disputes)
- Market resolves: `outcome = 2` (NO) ✅
- **NO shareholders win**

---

## The System Doesn't Automatically Know

### ❌ Wrong Understanding:
```
Market ends → Smart contract automatically checks Ethereum price → YES won
```

### ✅ Correct Understanding:
```
Market ends → Person checks Ethereum price → Person proposes YES → If undisputed, YES wins
```

**The contract is "dumb"** - it just accepts proposals unless challenged.

---

## Who Proposes?

**Anyone** can propose:
- Admin
- Regular user
- Community member
- Bot (if connected to price feeds)

**Who usually proposes?**
- People who care about the outcome
- People with YES/NO shares (they want resolution)
- Community members monitoring markets

---

## Outcome Values

| Value | Meaning | Winner |
|-------|---------|--------|
| `1` | **YES won** | Users with YES shares |
| `2` | **NO won** | Users with NO shares |
| `3` | **INVALID** | Everyone gets proportional refund |

---

## Summary

**How YES/NO Winner is Picked**:

1. ⏰ Market ends, resolution window opens
2. 👤 Someone checks real-world information
3. 📝 They propose: YES (`1`) or NO (`2`)
4. ⚔️ Others can dispute if wrong (within 1 day)
5. ✅ If undisputed → That proposal becomes the winner
6. 🏆 Winners can claim their winnings

**Key**: It's **human judgment** + **challenge mechanism** - not automatic.

---

## Visual Flow

```
Market Ends
    ↓
Resolution Time Reached
    ↓
Person Checks Real World → Proposes YES or NO
    ↓
    ├─ If WRONG → Someone disputes → New proposal
    │
    └─ If CORRECT → Nobody disputes
                      ↓
                   Finalize (free)
                      ↓
                   Winner Announced
                      ↓
                   Shareholders Claim
```

---

**The winner is determined by whoever makes a correct proposal that goes undisputed!**

