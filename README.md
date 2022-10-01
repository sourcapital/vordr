# Vǫrðr 👻👀⚡️

A monitoring application for THORNodes.

## Supported Chains

| Chain    | Subchain                                                           |
| -------- | ------------------------------------------------------------------ |
| Bitcoin  | Bitcoin (BTC), Litecoin (LTC), Bitcoin Cash (BCH), Dogecoin (DOGE) |
| Ethereum | Ethereum (ETH), Avalanche (AVAX)                                   |
| Cosmos   | Cosmos (ATOM), Binance (BNB), THORChain (RUNE)                     |

## Installation

Install all the required dependencies from `package.json`:

```
yarn
```

## Environment Variables

Set all the required .env variables:

```
LOGTAIL_API_KEY = XXX
# NODE_ENV = 'production' // if run in production
```

## Build

Compile `.ts` to `.js`:

```
yarn tsc
```

## Run

Run via `node`:

```
node src/main.js
```
