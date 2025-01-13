# Juicy Lucy

A modern web application powering Lucy, a professional AI influencer with a unique personality and style. Lucy engages with her community through social media, sharing experiences and insights about the Near Protocol ecosystem, particularly about $JLU and Shitzu Apes ($SHITZU).

🌐 [Website](https://juicylucy.ai) | 🐦 [Twitter/X](https://x.com/SimpsForLucy)

## Features

- Personality-driven AI interactions with configurable traits and memory
- Twitter/X integration for authentic social engagement
- Leonardo AI integration for visual content generation
- Knowledge and memory management for consistent character interactions
- Cloudflare Workers-based architecture for reliable performance

## Tech Stack

- Frontend: Svelte 5 with TypeScript
- Styling: UnoCSS
- Backend: Cloudflare Workers
- State Management: Durable Objects & KV
- AI Integration: OpenAI, Leonardo AI
- Social: Twitter/X API

## Development

First, install dependencies:

```bash
yarn install
```

Create a `.dev.vars` file in the `api` directory with the necessary environment variables (see `api/types.d.ts` for required variables).

To start the development server:

```bash
yarn dev
```

## API Development

The API is located in the `api` directory and uses Cloudflare Workers. To develop the API:

```bash
yarn api dev
```

## Building for Production

```bash
yarn build
```

You can preview the production build with `yarn preview`.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
