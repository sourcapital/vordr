# Vǫrðr 👻👀⚡️

A monitoring application for THORNodes.

## Supported Chains

| Chain    | Subchain                                                           |
|----------|--------------------------------------------------------------------|
| Bitcoin  | Bitcoin (BTC), Litecoin (LTC), Bitcoin Cash (BCH), Dogecoin (DOGE) |
| Ethereum | Ethereum (ETH), Avalanche (AVAX)                                   |
| Cosmos   | Cosmos (ATOM), Binance (BNB), THORChain (RUNE)                     |

## Installation

Install all the required dependencies from `package.json`:

```
yarn install
```

## Environment Variables

Set all the required .env variables:

```
LOGTAIL_API_KEY = XXX
BETTERUPTIME_API_KEY = XXX
NODE_ENV = 'production' // if run in production
```

## Build

Compile `.ts` to `.js`:

```
yarn build
```

## Run

Run via `node`:

```
yarn start
```

## Deploy to a Kubernetes cluster

Create namespace:

```
kubectl create -f k8s-namespace.yaml
```

Create secret for pulling the docker image from the private registry:

```
kubectl create -f k8s-secret.yaml
```

Set both `LOGTAIL_API_KEY` and `BETTERUPTIME_API_KEY` in `k8s-deployment.yaml` and deploy the application:

```
kubectl create -f k8s-deployment.yaml
```

## Remove from a Kubernetes cluster

Each step from above can be reversed via:

```
kubectl delete -f ...
```