# Project Oracle - AI Prediction Assistant

An intelligent web application that analyzes betting odds and prediction markets using Google Gemini AI to provide data-driven predictions with optimized bankroll distribution strategies.

## Features

- **Multimodal AI Analysis**: Upload screenshots of odds/prediction markets and get instant analysis
- **Superforecasting Methodology**: Built on principles from Philip Tetlock and Nate Silver
- **Smart Distribution**: Automatic bankroll allocation using Kelly Criterion
- **Edge Detection**: Identifies mispriced probabilities and value opportunities
- **Interactive Sliders**: Adjust stake allocations with real-time rebalancing
- **Comprehensive Analysis**: Base rates, key factors, risk assessment, and market efficiency metrics

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS 4
- **State Management**: Zustand
- **AI**: Google Gemini 2.0 Flash (with optional Flash Thinking Experimental)
- **API**: Next.js API Routes (Serverless)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Google AI API key (get one at https://aistudio.google.com/app/apikey)

### Installation

1. Clone the repository
```bash
git clone <your-repo-url>
cd prediction
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables

Create a `.env.local` file in the root directory:
```env
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here
```

4. Run the development server
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. **Enter Your Question**: Type what you want to predict (e.g., "Who will win this matchup?")
2. **Set Your Bankroll**: Enter the total amount you want to allocate (e.g., $100)
3. **Upload Odds Screenshot**: Drag and drop or click to upload an image of betting odds
4. **Generate Prediction**: Click the button to analyze
5. **Review Results**: See the AI's prediction, confidence score, and recommended distribution
6. **Adjust Allocations**: Use the interactive sliders to customize your stake distribution

## How It Works

### 5-Phase Analysis Process

1. **Problem Decomposition**: Extracts options and odds via OCR, converts to implied probabilities
2. **Outside View**: Identifies reference classes and historical base rates
3. **Inside View**: Analyzes specific factors, catalysts, and blockers
4. **Red Teaming**: Pre-mortem analysis and bias checking
5. **Synthesis**: Merges base rates with evidence, calculates edges, recommends stakes

### Bankroll Distribution

The app uses the Kelly Criterion to optimize stake sizing:
- Calculates edge: AI probability - Market implied probability
- Applies fractional Kelly (25-50%) for safety
- Distributes bankroll proportionally across positive-edge options
- Allows manual adjustment with automatic rebalancing

## Project Structure

```
prediction/
├── app/
│   ├── api/
│   │   └── predict/
│   │       └── route.ts          # API endpoint for predictions
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Main page component
│   └── globals.css               # Global styles
├── components/
│   ├── ImageUpload.tsx           # Drag-drop image uploader
│   ├── InputForm.tsx             # Question and bankroll inputs
│   ├── MoneySlider.tsx           # Individual option slider
│   └── PredictionResults.tsx    # Results display
├── lib/
│   ├── systemPrompt.ts           # Gemini AI system prompt
│   ├── types.ts                  # TypeScript interfaces
│   └── store.ts                  # Zustand state management
├── .env.local                    # Environment variables (not in git)
├── next.config.ts                # Next.js configuration
├── tailwind.config.ts            # Tailwind CSS configuration
└── tsconfig.json                 # TypeScript configuration
```

## API Reference

### POST /api/predict

Analyzes odds and generates predictions.

**Request Body:**
```json
{
  "question": "Who will win the NFC North?",
  "imageBase64": "data:image/jpeg;base64,...",
  "bankroll": 100
}
```

**Response:**
```json
{
  "prediction": {
    "winner": "Team A",
    "confidence": 68.5,
    "reasoning": "Analysis explanation..."
  },
  "options": [
    {
      "name": "Team A",
      "impliedProbability": 45.5,
      "aiProbability": 68.5,
      "edge": 23.0,
      "recommendedStake": 60,
      "recommendedAmount": 60
    }
  ],
  "analysis": {
    "baseRate": "Reference class analysis...",
    "keyFactors": ["Factor 1", "Factor 2"],
    "risks": "Pre-mortem risk assessment...",
    "confidence": "High"
  },
  "marketAnalysis": {
    "totalEdge": 23.0,
    "bestValue": "Team A",
    "marketEfficiency": "Market assessment..."
  }
}
```

## Gemini Model Options

The app uses **Gemini 2.0 Flash** by default for fast multimodal analysis. You can switch models in `app/api/predict/route.ts`:

- `gemini-2.0-flash-exp` - Fast, efficient (default)
- `gemini-2.0-flash-thinking-exp` - Enhanced reasoning for complex analysis
- `gemini-1.5-flash` - Stable, production-ready
- `gemini-1.5-pro` - Maximum capability for complex scenarios

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in Vercel
3. Add `GOOGLE_GENERATIVE_AI_API_KEY` environment variable
4. Deploy

### Other Platforms

Build the production version:
```bash
npm run build
npm run start
```

## Roadmap

- [ ] User authentication and prediction history
- [ ] Database integration (Supabase)
- [ ] Multiple image uploads
- [ ] Real-time odds tracking
- [ ] Performance analytics dashboard
- [ ] Export predictions as PDF/CSV
- [ ] Mobile app (React Native)

## Disclaimer

This tool provides AI-generated predictions for educational and analytical purposes only. It should not be considered financial advice. Always gamble responsibly and within your means. Past performance does not guarantee future results.

## License

ISC

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Support

For issues or questions, please open an issue on GitHub.
