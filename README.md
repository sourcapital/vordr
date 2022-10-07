# Vǫrðr 👻👀⚡️

A monitoring application for THORNodes.

> A Vǫrðr or warden is a guardian spirit who will follow the soul of a living person from birth until death.

## Supported Chains

| Chain    | Subchain                                                           |
|----------|--------------------------------------------------------------------|
| Bitcoin  | Bitcoin (BTC), Litecoin (LTC), Bitcoin Cash (BCH), Dogecoin (DOGE) |
| Ethereum | Ethereum (ETH), Avalanche (AVAX)                                   |
| Cosmos   | Cosmos (ATOM), Binance (BNB), THORChain (RUNE)                     |

## Local Environment

### Installation

Install all the required dependencies from `package.json`:

```
yarn install
```

### Build

Compile `.ts` to `.js`:

```
yarn build
```

### Environment Variables

Set all the environment variables:

```
LOGTAIL_API_KEY = XXX
BETTERUPTIME_API_KEY = XXX
NODE_ENV = 'production' // if run in production
```

### Run

Run via `node.js`:

```
yarn start
```

## Kubernetes

### Deploy to cluster

Set both all environment variables in `k8s-deployment.yaml` and deploy the application:

```
kubectl create -f k8s-deployment.yaml
```

### Remove from cluster

Remove the application from the Kubernetes cluster:

```
kubectl delete -f k8s-deployment.yaml
```

## License

MIT License

Copyright (c) 2022 Sour Capital Pte. Ltd.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.