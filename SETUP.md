# Setup Guide for Project Oracle

## Quick Start

### 1. Get Your Google AI API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key

### 2. Configure Environment Variables

Open the `.env.local` file in the root directory and replace `your_api_key_here` with your actual API key:

```env
GOOGLE_GENERATIVE_AI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### 3. Install Dependencies

If you haven't already, run:

```bash
npm install
```

### 4. Start Development Server

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000)

## Testing the Application

### Test with Sample Data

1. Find any betting odds screenshot online (sports betting, prediction markets, etc.)
2. Upload it to the application
3. Enter a question like "Who will win this game?"
4. Set a bankroll amount (e.g., $100)
5. Click "Generate Prediction"

### Expected Behavior

The AI should:
- Extract all options and odds from the image via OCR
- Calculate implied probabilities from the odds
- Provide its own probability estimates
- Identify positive edges (where AI disagrees with market)
- Recommend bankroll distribution across options

## Troubleshooting

### API Key Issues

**Error: "Invalid API key"**
- Double-check your API key in `.env.local`
- Make sure there are no extra spaces or quotes
- Restart the dev server after changing `.env.local`

**Error: "API key not found"**
- Ensure `.env.local` exists in the root directory
- File must be named exactly `.env.local`
- Restart the dev server

### Image Upload Issues

**Error: "Failed to parse AI response"**
- The image might be too low quality
- Try a clearer screenshot with visible text
- Ensure the image contains betting odds or similar data

**Error: "Missing required fields"**
- Make sure you've uploaded an image
- Enter a question (can use the default)
- Set a bankroll amount

### Build Issues

**Module not found errors**
- Run `npm install` to ensure all dependencies are installed
- Delete `node_modules` and `.next` folders, then run `npm install` again

**TypeScript errors**
- Run `npm run build` to check for type errors
- Ensure `tsconfig.json` is properly configured

## Model Selection

The app uses **Gemini 2.0 Flash** by default. To change the model:

1. Open `app/api/predict/route.ts`
2. Find this line:
   ```typescript
   model: 'gemini-2.0-flash-exp',
   ```
3. Replace with one of:
   - `gemini-2.0-flash-exp` - Fast (default)
   - `gemini-2.0-flash-thinking-exp` - Enhanced reasoning
   - `gemini-1.5-flash` - Stable, production
   - `gemini-1.5-pro` - Maximum capability

## Production Deployment

### Vercel Deployment

1. Push your code to GitHub (don't commit `.env.local`)
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Add environment variable:
   - Key: `GOOGLE_GENERATIVE_AI_API_KEY`
   - Value: Your API key
5. Deploy

### Environment Variables for Production

In production, set these environment variables:
- `GOOGLE_GENERATIVE_AI_API_KEY` - Your Google AI API key

## File Structure Overview

```
prediction/
├── app/
│   ├── api/predict/route.ts     # Main API endpoint
│   ├── page.tsx                  # Homepage UI
│   ├── layout.tsx                # App layout
│   └── globals.css               # Global styles
├── components/
│   ├── ImageUpload.tsx           # Image uploader
│   ├── InputForm.tsx             # Input fields
│   ├── MoneySlider.tsx           # Stake slider
│   └── PredictionResults.tsx    # Results display
├── lib/
│   ├── systemPrompt.ts           # AI instructions
│   ├── types.ts                  # TypeScript types
│   └── store.ts                  # State management
├── .env.local                    # API keys (DO NOT COMMIT)
├── .gitignore                    # Git ignore rules
├── next.config.ts                # Next.js config
├── package.json                  # Dependencies
├── README.md                     # Documentation
└── SETUP.md                      # This file
```

## Next Steps

1. Customize the system prompt in `lib/systemPrompt.ts` for your use case
2. Add authentication if needed
3. Set up a database (Supabase recommended) for prediction history
4. Deploy to production

## Support

For issues:
1. Check this guide first
2. Review the README.md
3. Check the console for error messages
4. Open an issue on GitHub
