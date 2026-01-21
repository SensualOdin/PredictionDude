# 🚀 Quick Start - Project Oracle

## 3-Step Setup

### 1️⃣ Get API Key
Go to: https://aistudio.google.com/app/apikey

### 2️⃣ Add to .env.local
```env
GOOGLE_GENERATIVE_AI_API_KEY=AIzaSy...
```

### 3️⃣ Run
```bash
npm run dev
```

Open: http://localhost:3000

---

## Usage

1. **Upload** a screenshot of betting odds
2. **Enter** your question
3. **Set** your bankroll amount
4. **Click** "Generate Prediction"
5. **Adjust** sliders to customize distribution

---

## Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
node verify-setup.js  # Verify setup
```

---

## Troubleshooting

**"Invalid API key"**
- Check `.env.local` has correct key
- Restart dev server: Ctrl+C then `npm run dev`

**"Module not found"**
- Run: `npm install`

**Need Help?**
- See: `SETUP.md`
- See: `README.md`

---

**That's it! Happy forecasting! 🎯**
