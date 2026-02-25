# Nanda AI — Chat App

This is a small Next.js app that proxies prompts to a model backend.

Quick start (local):

1. Install dependencies

```bash
npm install
```

2. Run Next.js dev

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

Backends supported:
- Hugging Face Inference API (recommended for deployment)
- Local Ollama server (default for local development)

Environment variables (for deployment):
- `HF_API_KEY` — your Hugging Face API token. When present, the app will use Hugging Face for generation.
- `HF_MODEL` — model name on Hugging Face (default: `gpt2`).

Deploy to Vercel (free tier):

1. Push this repo to GitHub.
2. Create an account at https://vercel.com and import the GitHub repo.
3. In Vercel project settings > Environment Variables, add `HF_API_KEY` with your Hugging Face token.
4. Deploy — Vercel will build and publish. The final URL will be shown in the Vercel dashboard.

Notes:
- If you deploy without `HF_API_KEY`, the app will try to contact a local Ollama server which won't be available on Vercel.
- Hugging Face has a free quota; check your account limits.

If you want, provide a GitHub repo URL or give me permission to push, and I will finish the deploy steps and return the live link.
