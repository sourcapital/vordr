# Vǫrðr 👻

A monitoring application for THORNodes.

> A Vǫrðr or warden is a guardian spirit who will follow the soul of a living person from birth until death.

## Features

- All chains are monitored for `Health` and `Sync Status` every minute
- THORChain version is monitored every minute
- Kubernetes pod restarts are monitored every minute
- Kubernetes pod logs of all chains are aggregated
- Slash points are monitored every minute
- Jailing is monitored every minute
- Chain observations are monitored every minute

## Supported Chains

| Client   | Chain                                                              |
|----------|--------------------------------------------------------------------|
| Bitcoin  | Bitcoin (BTC), Litecoin (LTC), Bitcoin Cash (BCH), Dogecoin (DOGE) |
| Ethereum | Ethereum (ETH), Avalanche (AVAX), Binance Smart (BSC)              |
| Cosmos   | Cosmos (ATOM), Binance (BNB), THORChain (RUNE)                     |

## Environment Variables

| Key                         | Required | Description                                                                                                                                              |
|-----------------------------|----------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| NODE_ENV                    | No       | Set to `production`, if you want to run the application in production.                                                                                   |
| BETTERSTACK_API_KEY         | Yes      | BetterStack API key, see [here](#uptime).                                                                                                                |
| LOGS_SOURCE_TOKEN           | No       | BetterStack Logs source token, see [here](#logs-optional).                                                                                               |
| THORNODE_ADDRESS            | Yes      | Set to the address of your THORNode (`thor...`).                                                                                                         |
| NODE_ENDPOINT_THORNODE      | Yes      | THORNode endpoint (e.g. http://thornode.thornode:1317).                                                                                                  |
| NODE_ENDPOINT_THORCHAIN     | Yes      | THORChain endpoint (e.g. http://thornode.thornode:27147).                                                                                                |
| NODE_ENDPOINT_BINANCE_CHAIN | Yes      | Binance endpoint (e.g. http://binance-daemon.thornode:27147).                                                                                            |
| NODE_ENDPOINT_BITCOIN       | Yes      | Bitcoin endpoint (e.g. [http://thorchain:password@bitcoin-daemon.thornode:8332](http://thorchain:password@bitcoin-daemon.thornode:8332)).                |
| NODE_ENDPOINT_ETHEREUM      | Yes      | Ethereum endpoint (e.g. http://ethereum-daemon.thornode:8545).                                                                                           |
| NODE_ENDPOINT_LITECOIN      | Yes      | Litecoin endpoint (e.g. [http://thorchain:password@litecoin-daemon.thornode:9332](http://thorchain:password@litecoin-daemon.thornode:9332)).             |
| NODE_ENDPOINT_BITCOIN_CASH  | Yes      | Bitcoin Cash endpoint (e.g. [http://thorchain:password@bitcoin-cash-daemon.thornode:8332](http://thorchain:password@bitcoin-cash-daemon.thornode:8332)). |
| NODE_ENDPOINT_DOGECOIN      | Yes      | Dogecoin endpoint (e.g. [http://thorchain:password@dogecoin-daemon.thornode:22555](http://thorchain:password@dogecoin-daemon.thornode:22555)).           |
| NODE_ENDPOINT_COSMOS        | Yes      | Cosmos endpoint (e.g. http://gaia-daemon.thornode:26657).                                                                                                |
| NODE_ENDPOINT_AVALANCHE     | Yes      | Avalanche endpoint (e.g. http://avalanche-daemon.thornode:9650/ext/bc/C/rpc).                                                                            |
| NODE_ENDPOINT_BINANCE_SMART | Yes      | Binance Smart endpoint (e.g. http://binance-smart-daemon.thornode:8545).                                                                                 |

## Kubernetes

### Deploy to Cluster

Set all environment variables in `k8s-deployment.yaml` and deploy the application:

```
kubectl create -f k8s-deployment.yaml
```

### Remove from Cluster

Remove the application from the Kubernetes cluster:

```
kubectl delete -f k8s-deployment.yaml
```

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

### Run

Run via `node.js`:

```
yarn start
```

## BetterStack

### Uptime

BetterStack Uptime is used for alerting and incident management.

- Heartbeats are sent every minute for `Health` and `Sync Status` of the nodes
- Missed heartbeats create incidents
- Kubernetes pod restarts create incidents
- High slash points create incidents
- Jailing creates incidents
- Lagging chain observations create incidents
- Outdated THORChain versions creates incidents

#### API Key

Sign up at [betterstack.com](https://uptime.betterstack.com/?ref=8l7f) and follow the [docs](https://betterstack.com/docs/uptime/api/getting-started-with-uptime-api/) to get the API key.

### Logs (optional)

BetterStack Logs is used for log manangement and dashboard visualization.

- Vǫrðr forwards its own logs
- k8s `error` and `warn` logs are also forwarded

#### Source Token

Sign up at [betterstack.com](https://logs.betterstack.com/?ref=8l7f) and follow the [docs](https://betterstack.com/docs/logs/logging-start/) to get a source token for the platform `JavaScript • Node.js`.

## License

```
MIT License

Copyright (c) 2023 Sour Capital Pte. Ltd.

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
```
