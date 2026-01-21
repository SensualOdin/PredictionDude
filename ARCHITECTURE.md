# Project Oracle - System Architecture

## High-Level Flow

```
┌─────────────┐
│    User     │
└──────┬──────┘
       │
       │ 1. Upload odds image
       │ 2. Enter question
       │ 3. Set bankroll
       ▼
┌─────────────────────────────┐
│     Next.js Frontend        │
│  (app/page.tsx)             │
│                             │
│  ┌───────────────────────┐  │
│  │  Input Components     │  │
│  │  - ImageUpload        │  │
│  │  - InputForm          │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │  State Management     │  │
│  │  (Zustand Store)      │  │
│  └───────────────────────┘  │
└──────────┬──────────────────┘
           │
           │ POST /api/predict
           │ { question, imageBase64, bankroll }
           ▼
┌─────────────────────────────┐
│   Next.js API Route         │
│  (app/api/predict/route.ts) │
│                             │
│  1. Validate inputs         │
│  2. Prepare system prompt   │
│  3. Call Gemini API         │
│  4. Parse JSON response     │
│  5. Calculate $ amounts     │
└──────────┬──────────────────┘
           │
           │ Gemini API Call
           ▼
┌─────────────────────────────┐
│   Google Gemini 2.0 Flash   │
│                             │
│  ┌───────────────────────┐  │
│  │  System Prompt        │  │
│  │  - Superforecasting   │  │
│  │  - 5-Phase Process    │  │
│  │  - JSON Schema        │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │  Image Analysis       │  │
│  │  - OCR extraction     │  │
│  │  - Odds parsing       │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │  Reasoning Engine     │  │
│  │  - Base rates         │  │
│  │  - Evidence analysis  │  │
│  │  - Edge calculation   │  │
│  │  - Kelly sizing       │  │
│  └───────────────────────┘  │
└──────────┬──────────────────┘
           │
           │ Structured JSON Response
           ▼
┌─────────────────────────────┐
│     Frontend UI             │
│                             │
│  ┌───────────────────────┐  │
│  │  PredictionResults    │  │
│  │  - Winner display     │  │
│  │  - Confidence score   │  │
│  │  - Analysis details   │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │  MoneySlider (x N)    │  │
│  │  - Interactive slider │  │
│  │  - Auto-rebalancing   │  │
│  │  - Visual distribution│  │
│  └───────────────────────┘  │
└──────────┬──────────────────┘
           │
           │ User adjusts stakes
           ▼
      ┌─────────┐
      │  Zustand│
      │  Store  │
      └─────────┘
```

---

## Component Hierarchy

```
app/page.tsx (Main Page)
│
├── InputForm
│   ├── Question Input
│   ├── Bankroll Input
│   └── ImageUpload
│       └── Drag-drop zone
│
└── PredictionResults (conditional)
    ├── Winner Card
    ├── Analysis Section
    ├── Market Analysis Grid
    ├── Key Factors List
    ├── Risk Assessment
    ├── MoneySlider (for each option)
    │   └── Range input + visual bar
    └── Detailed Table
```

---

## Data Flow

### 1. Input Phase
```typescript
User Input → Zustand Store
{
  question: string
  bankroll: number
  imageFile: File
  imagePreview: string (base64)
}
```

### 2. API Request
```typescript
POST /api/predict
{
  question: "Who will win?",
  imageBase64: "data:image/jpeg;base64,...",
  bankroll: 100
}
```

### 3. Gemini Processing
```
Image + Prompt → Gemini 2.0 Flash
│
├── Phase 1: Extract options/odds via OCR
├── Phase 2: Calculate base rates
├── Phase 3: Analyze specific factors
├── Phase 4: Red team & bias check
└── Phase 5: Synthesize & calculate edges
```

### 4. API Response
```typescript
{
  prediction: {
    winner: "Option A",
    confidence: 72.5,
    reasoning: "..."
  },
  options: [
    {
      name: "Option A",
      impliedProbability: 50,
      aiProbability: 72.5,
      edge: 22.5,
      recommendedStake: 45,
      recommendedAmount: 45
    },
    // ... more options
  ],
  analysis: { ... },
  marketAnalysis: { ... }
}
```

### 5. UI Update
```
Response → Zustand Store → React Re-render
│
└── PredictionResults component displays:
    - Animated cards
    - Interactive sliders
    - Detailed tables
```

---

## State Management (Zustand)

```typescript
usePredictionStore
│
├── State
│   ├── question: string
│   ├── bankroll: number
│   ├── imageFile: File | null
│   ├── imagePreview: string | null
│   ├── isLoading: boolean
│   ├── prediction: PredictionResponse | null
│   └── error: string | null
│
└── Actions
    ├── setQuestion(question)
    ├── setBankroll(bankroll)
    ├── setImageFile(file)
    ├── setImagePreview(preview)
    ├── setLoading(loading)
    ├── setPrediction(prediction)
    ├── setError(error)
    ├── updateStake(optionName, newStake)
    │   └── Auto-rebalances other options
    └── reset()
```

---

## Gemini System Prompt Architecture

```
System Prompt (lib/systemPrompt.ts)
│
├── Core Identity
│   ├── Superforecasting principles
│   ├── Signal-vs-noise framework
│   └── Bayesian reasoning
│
├── JSON Output Schema
│   └── Strict structure enforcement
│
├── 5-Phase Protocol
│   ├── 1. Problem Decomposition
│   ├── 2. Outside View (Base Rates)
│   ├── 3. Inside View (Evidence)
│   ├── 4. Red Teaming
│   └── 5. Synthesis
│
├── Stake Distribution Algorithm
│   ├── Kelly Criterion calculation
│   └── Fractional Kelly safety
│
└── Debiasing Checklist
    ├── Anchoring
    ├── Confirmation bias
    ├── Recency bias
    └── Overconfidence
```

---

## API Route Logic

```
route.ts (app/api/predict/route.ts)
│
├── 1. Validate Request
│   └── Check question, image, bankroll
│
├── 2. Initialize Gemini
│   └── Model: gemini-2.0-flash-exp
│       ├── temperature: 0.4
│       ├── topP: 0.95
│       └── maxTokens: 8192
│
├── 3. Prepare Content
│   ├── System prompt
│   ├── User query
│   └── Image (base64)
│
├── 4. Generate Response
│   └── model.generateContent([image, prompt])
│
├── 5. Parse JSON
│   └── Extract structured prediction
│
├── 6. Enhance Response
│   └── Calculate dollar amounts for each option
│
└── 7. Return to Client
    └── NextResponse.json(data)
```

---

## Key Algorithms

### Edge Calculation
```
Edge = AI_Probability - Implied_Probability

Example:
- Market odds: +200 → Implied: 33.3%
- AI estimate: 50%
- Edge: +16.7% (positive edge = value bet)
```

### Kelly Criterion
```
Kelly % = (bp - q) / b

Where:
- b = odds received
- p = win probability (AI estimate)
- q = loss probability (1 - p)

Fractional Kelly = Kelly % × 0.25 to 0.5
(reduces variance, safer)
```

### Stake Distribution
```
For each positive-edge option:
1. Calculate Kelly %
2. Apply fractional multiplier (0.25-0.5)
3. Normalize so total ≤ 100%

Example with $100 bankroll:
- Option A: 22.5% edge → 45% stake → $45
- Option B: 10% edge → 20% stake → $20
- Option C: -5% edge → 0% stake → $0
Total: 65% of bankroll allocated
```

### Auto-Rebalancing
```
When user adjusts one slider:
1. Calculate total stake
2. If total > 100%:
   - Calculate excess
   - Proportionally reduce other options
   - Maintain relative ratios
3. Update all sliders
4. Recalculate dollar amounts
```

---

## Performance Considerations

### Client-Side
- Image compression before upload
- Debounced slider updates
- Optimistic UI updates
- React memoization for sliders

### Server-Side
- Serverless API routes (auto-scaling)
- Stateless design
- Fast Gemini 2.0 Flash model
- Streaming responses (future enhancement)

### Gemini API
- Model choice: Flash (speed) vs Pro (accuracy)
- Token limits: 8192 max output
- Temperature: 0.4 (balanced)
- Caching: 15min cache window

---

## Security & Best Practices

### API Key Protection
- Stored in `.env.local`
- Never exposed to client
- Server-side only usage

### Input Validation
- File type checking
- Size limits
- Sanitized inputs
- Error boundaries

### Rate Limiting
- Implement in production
- Use Vercel rate limiting
- Gemini API quotas

---

## Deployment Architecture

```
GitHub Repository
│
├── Push to main
│
▼
Vercel Build System
│
├── Install dependencies
├── Build Next.js app
├── Set environment variables
│   └── GOOGLE_GENERATIVE_AI_API_KEY
│
▼
Vercel Edge Network
│
├── Static assets (CDN)
├── Serverless functions (API routes)
└── Auto-scaling based on traffic
```

---

## File Size Breakdown

```
Total: ~50KB (excluding node_modules)

app/                    ~15KB
├── page.tsx            ~5KB
├── layout.tsx          ~1KB
├── globals.css         ~2KB
└── api/predict/        ~7KB

components/             ~15KB
├── ImageUpload.tsx     ~3KB
├── InputForm.tsx       ~2KB
├── MoneySlider.tsx     ~3KB
└── PredictionResults.tsx ~7KB

lib/                    ~10KB
├── systemPrompt.ts     ~6KB
├── store.ts            ~3KB
└── types.ts            ~1KB

Config files:           ~5KB
Documentation:          ~30KB
```

---

## Technology Decisions

| Choice | Reason |
|--------|--------|
| Next.js 15 | App Router, API routes, TypeScript support |
| React 19 | Latest features, concurrent rendering |
| Tailwind 4 | Utility-first, rapid prototyping |
| Zustand | Lightweight, no boilerplate |
| Gemini 2.0 | Multimodal, fast, cost-effective |
| TypeScript | Type safety, better DX |
| Serverless | Auto-scaling, cost-effective |

---

## Future Architecture Enhancements

1. **Database Layer**
   - Add Supabase PostgreSQL
   - Store prediction history
   - User authentication

2. **Caching Layer**
   - Redis for API responses
   - Reduce Gemini API calls

3. **Analytics**
   - Track prediction accuracy
   - Performance metrics
   - User behavior

4. **Real-time Updates**
   - WebSocket connections
   - Live odds tracking
   - Push notifications

5. **Advanced Features**
   - Batch image processing
   - PDF report generation
   - API for external integrations
